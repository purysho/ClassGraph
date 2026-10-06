import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { dispatchClassGraphApi } from '../src/api-dispatch.js'
import { serializeProjectJson } from '../src/json.js'
import { FileProjectStore } from '../src/project-store.js'
import { addMetricDefinition, setStudentMetricValue } from '../src/metrics.js'
import type { ClassGraphProject, MetricDefinition, MetricValue } from '../src/model.js'
import { compareTerms, startNextTerm, termComparisonCsv } from '../src/term-comparison.js'
import { addStudent, createEmptyProject } from '../src/workspace.js'

const now = '2026-10-06T10:00:00.000Z'
const directories: string[] = []

afterEach(async () => {
  await Promise.all(directories.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

const SCORE: MetricDefinition = {
  key: 'score',
  label: 'Score',
  kind: 'number',
  numberScale: { min: 0, max: 100 },
}
const LEVEL: MetricDefinition = {
  key: 'level',
  label: 'Reading level',
  kind: 'ordinal',
  ordinalScale: ['A', 'B', 'C'],
}
const HOUSE: MetricDefinition = {
  key: 'house',
  label: 'House',
  kind: 'category',
  categories: ['Red', 'Blue', 'Green'],
}
const NOTE: MetricDefinition = { key: 'note', label: 'Note', kind: 'text' }

function term(
  id: string,
  termName: string,
  definitions: MetricDefinition[],
  students: Array<[string, string, Record<string, MetricValue>]>,
): ClassGraphProject {
  let project = createEmptyProject({
    projectId: id,
    title: 'Grade 5A English',
    classInfo: { term: termName },
    now,
  })
  for (const definition of definitions) project = addMetricDefinition(project, definition, now)
  for (const [studentId, name, values] of students) {
    project = addStudent(project, { id: studentId, displayName: name }, now)
    for (const [key, value] of Object.entries(values)) {
      project = setStudentMetricValue(project, studentId, key, value, now)
    }
  }
  return project
}

const earlier = term(
  't1',
  'Term 1',
  [SCORE, LEVEL, HOUSE, NOTE],
  [
    ['s1', '张喆', { score: 60, level: 'A', house: 'Red', note: 'x' }],
    ['s2', 'Ben', { score: 80, level: 'B', house: 'Blue' }],
    ['s3', 'Cai', { score: null, level: 'C', house: 'Red' }],
    ['s4', 'Dee', { score: 70 }],
  ],
)
const later = term(
  't2',
  'Term 2',
  [SCORE, LEVEL, HOUSE, NOTE, { ...HOUSE, key: 'club', label: 'Club' }],
  [
    ['s1', '张喆', { score: 72, level: 'B', house: 'Red' }],
    ['s2', 'Ben', { score: 75, level: 'B', house: 'Green' }],
    ['s3', 'Cai', { score: 90, level: 'A', house: 'Red' }],
    ['s5', 'Eve', { score: 88 }],
  ],
)

describe('compareTerms', () => {
  const comparison = compareTerms(earlier, later)
  const metric = (key: string) => comparison.metrics.find((item) => item.key === key)!

  it('matches students by ID and lists who is only in one term', () => {
    expect(comparison.roster).toEqual({ bothCount: 3, onlyEarlier: ['s4'], onlyLater: ['s5'] })
    expect(comparison.students.map((student) => student.id)).toEqual(['s1', 's2', 's3', 's5', 's4'])
    expect(comparison.earlier.term).toBe('Term 1')
  })

  it('describes numeric changes only for students recorded in both terms', () => {
    const score = metric('score')
    // s3 is Missing earlier, so only s1 (+12) and s2 (-5) are compared.
    expect(score.pairCount).toBe(2)
    expect(score.notComparedCount).toBe(1)
    expect([score.higherCount, score.lowerCount, score.sameCount]).toEqual([1, 1, 0])
    expect(score.medianChange).toBe(3.5)
    expect(score.earlier).toMatchObject({ recordedCount: 3, missingCount: 1, median: 70 })
    expect(score.later).toMatchObject({ recordedCount: 4, missingCount: 0, min: 72, max: 90 })

    const s3 = score.rows.find((row) => row.studentId === 's3')!
    expect(s3.earlier.state).toBe('missing')
    expect(s3.change).toBeNull()
    const s4 = score.rows.find((row) => row.studentId === 's4')!
    expect(s4.later.state).toBe('not-in-term')
  })

  it('counts ordinal changes in scale steps and keeps transitions', () => {
    const level = metric('level')
    expect(level.levels).toEqual(['A', 'B', 'C'])
    expect([level.higherCount, level.lowerCount, level.sameCount]).toEqual([1, 1, 1])
    expect(level.rows.find((row) => row.studentId === 's3')!.change).toBe(-2)
    expect(level.transitions).toEqual({ A: { B: 1 }, B: { B: 1 }, C: { A: 1 } })
  })

  it('treats categories as changed or the same, never higher or lower', () => {
    const house = metric('house')
    expect([house.higherCount, house.lowerCount]).toEqual([0, 0])
    expect([house.changedCount, house.sameCount]).toEqual([1, 2])
    expect(house.levels).toEqual(['Red', 'Blue', 'Green'])
    expect(house.transitions).toEqual({ Red: { Red: 2 }, Blue: { Green: 1 } })
  })

  it('does not compare text, metrics in one term only, or changed scales', () => {
    const changedScale = term('t3', 'Term 3', [{ ...SCORE, numberScale: { min: 0, max: 50 } }], [])
    const changedKind = term(
      't4',
      'Term 4',
      [{ ...LEVEL, kind: 'category', categories: ['A', 'B', 'C'] }],
      [],
    )
    expect(comparison.notCompared).toEqual([
      { key: 'note', earlierLabel: 'Note', laterLabel: 'Note', reason: 'text' },
      { key: 'club', earlierLabel: null, laterLabel: 'Club', reason: 'only-later' },
    ])
    expect(compareTerms(earlier, changedScale).notCompared[0]).toMatchObject({
      key: 'score',
      reason: 'scale-changed',
    })
    expect(compareTerms(earlier, changedKind).notCompared[0]).toMatchObject({
      key: 'level',
      reason: 'kind-changed',
    })
    expect(
      compareTerms(earlier, term('t5', 'T5', [{ ...LEVEL, ordinalScale: ['C', 'B', 'A'] }], []))
        .notCompared[0]?.reason,
    ).toBe('scale-changed')
  })
})

describe('termComparisonCsv', () => {
  it('writes every value state as a word, guards formulas and starts with a BOM', () => {
    const risky = term(
      'r1',
      'T1',
      [{ ...HOUSE, categories: ['@x'] }],
      [['=cmd', '+SUM(A1)', { house: '@x' }]],
    )
    const csv = termComparisonCsv(compareTerms(risky, later))
    expect(csv.startsWith('﻿')).toBe(true)
    expect(csv).toContain("'=cmd")
    expect(csv).toContain("'+SUM(A1)")
    expect(csv).toContain("'@x")

    const lines = termComparisonCsv(compareTerms(earlier, later)).slice(1).trim().split('\r\n')
    expect(lines[0]).toBe(
      'student_id,earlier_name,later_name,score_earlier,score_later,score_change,level_earlier,level_later,level_change,house_earlier,house_later',
    )
    expect(lines[1]).toBe('s1,张喆,张喆,60,72,12,A,B,1,Red,Red')
    expect(lines[3]).toBe('s3,Cai,Cai,missing,90,not-compared,C,A,-2,Red,Red')
    expect(lines[4]).toBe(
      's5,,Eve,not-in-term,88,not-compared,not-in-term,not-recorded,not-compared,not-in-term,not-recorded',
    )
  })
})

describe('term comparison API', () => {
  const FAST = { N: 2 ** 10, r: 8, p: 1 }

  async function store(): Promise<FileProjectStore> {
    const directory = await mkdtemp(join(tmpdir(), 'classgraph-terms-'))
    directories.push(directory)
    const created = new FileProjectStore(directory)
    created.scryptParams = FAST
    return created
  }

  const call = (target: FileProjectStore | undefined, path: string, body: unknown) =>
    dispatchClassGraphApi(
      { method: 'POST', path, body: JSON.stringify(body) },
      target ? { projectStore: target } : {},
    )
  const errorCode = (response: { body: unknown }) =>
    (JSON.parse(response.body as string) as { error: { code: string } }).error.code

  it('compares with a saved class, or a backup file, and exports CSV', async () => {
    const target = await store()
    await target.save(earlier)

    const saved = await call(target, '/api/compare/terms', {
      project: later,
      otherProjectId: 't1',
    })
    expect(saved.status).toBe(200)
    const { comparison } = JSON.parse(saved.body as string) as {
      comparison: ReturnType<typeof compareTerms>
    }
    expect(comparison.roster.bothCount).toBe(3)
    expect(comparison.earlier.projectId).toBe('t1')

    // The open class can also be the earlier term.
    const reversed = await call(target, '/api/compare/terms', {
      project: later,
      otherProjectId: 't1',
      currentTerm: 'earlier',
    })
    expect(
      (JSON.parse(reversed.body as string) as { comparison: ReturnType<typeof compareTerms> })
        .comparison.earlier.projectId,
    ).toBe('t2')

    const fromFile = await call(undefined, '/api/compare/terms', {
      project: later,
      otherText: serializeProjectJson(earlier),
    })
    expect(fromFile.status).toBe(200)

    const csv = await call(undefined, '/api/export/term-comparison-csv', {
      project: later,
      otherText: serializeProjectJson(earlier),
    })
    expect(csv.contentType).toContain('text/csv')
    expect(String(csv.body)).toContain('s1,张喆,张喆,60,72,12')
  })

  it('needs the password for a protected backup and refuses comparing a class with itself', async () => {
    const source = await store()
    await source.protect(earlier, 'correct horse')
    const backup = await source.serializeBackup(earlier, false)

    expect(
      errorCode(await call(undefined, '/api/compare/terms', { project: later, otherText: backup })),
    ).toBe('CG-2015')
    expect(
      errorCode(
        await call(undefined, '/api/compare/terms', {
          project: later,
          otherText: backup,
          otherPassword: 'wrong horse',
        }),
      ),
    ).toBe('CG-2017')
    const unlocked = await call(undefined, '/api/compare/terms', {
      project: later,
      otherText: backup,
      otherPassword: 'correct horse',
    })
    expect(unlocked.status).toBe(200)

    expect(
      errorCode(
        await call(undefined, '/api/compare/terms', {
          project: later,
          otherText: serializeProjectJson(later),
        }),
      ),
    ).toBe('CG-3012')
  })

  it('starts the next term with the same students and metrics but no values', async () => {
    const target = await store()
    const response = await call(target, '/api/project/next-term', {
      project: earlier,
      projectId: 't1-next',
      title: 'Grade 5A English',
      term: 'Term 2',
    })
    expect(response.status).toBe(200)
    const { project: next } = JSON.parse(response.body as string) as {
      project: ClassGraphProject
    }
    expect(next.classInfo?.term).toBe('Term 2')
    expect(next.students.map((student) => [student.id, student.displayName])).toEqual([
      ['s1', '张喆'],
      ['s2', 'Ben'],
      ['s3', 'Cai'],
      ['s4', 'Dee'],
    ])
    expect(next.students.every((student) => Object.keys(student.metrics).length === 0)).toBe(true)
    expect(next.metricDefinitions.map((definition) => definition.key)).toEqual(
      earlier.metricDefinitions.map((definition) => definition.key),
    )
    expect(next.provenance['/students/0/id']).toEqual({
      kind: 'derived',
      source: 'next-term:t1',
    })
    expect((await target.list()).projects.map((item) => item.projectId)).toEqual(['t1-next'])

    // Everything is not recorded in the new term until the teacher records it.
    const score = compareTerms(earlier, next).metrics.find((metric) => metric.key === 'score')!
    expect([score.pairCount, score.notComparedCount, score.later.notRecordedCount]).toEqual([
      0, 4, 4,
    ])
    expect(() => startNextTerm(earlier, { projectId: 't1', title: 'x', term: '', now })).toThrow(
      'CG-1001',
    )
  })
})
