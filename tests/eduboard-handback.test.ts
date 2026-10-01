import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import {
  buildEduBoardHandback,
  parseEduBoardHandbackJson,
  serializeEduBoardHandback,
} from '../src/eduboard-handback.js'
import type { ClassGraphProject } from '../src/model.js'

function fixtureProject(): ClassGraphProject {
  return {
    schemaVersion: '1.0',
    projectId: 'eduboard-fixture',
    title: 'Grade 5',
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T01:00:00.000Z',
    classInfo: { subject: 'English' },
    metricDefinitions: [{ key: 'score', label: 'Score', kind: 'number' }],
    students: [
      { id: 'edu-student-1', displayName: 'Student One', metrics: { score: 80 } },
      { id: 'edu-student-2', displayName: 'Synthetic Student', metrics: { score: 60 } },
    ],
    room: {
      layout: 'grid',
      rows: 2,
      columns: 2,
      front: 'top',
      seats: [
        { id: 'seat-r1-c1', row: 0, column: 0, enabled: true },
        { id: 'seat-r1-c2', row: 0, column: 1, enabled: true },
        { id: 'seat-r2-c1', row: 1, column: 0, enabled: true },
        { id: 'seat-r2-c2', row: 1, column: 1, enabled: true },
      ],
    },
    planning: {
      seed: 'approved',
      assignments: [
        { studentId: 'edu-student-1', seatId: 'seat-r1-c1', locked: true },
        { studentId: 'edu-student-2', seatId: 'seat-r2-c2', locked: false },
      ],
      groups: [{ id: 'group-1', studentIds: ['edu-student-1', 'edu-student-2'] }],
      rules: [],
    },
    provenance: {
      '/title': { kind: 'teacher-entered' },
      '/students/0/displayName': { kind: 'imported', source: 'EduBoard fixture' },
      '/students/0/metrics/score': { kind: 'observed' },
      '/students/1/displayName': { kind: 'synthetic' },
      '/students/1/metrics/score': { kind: 'synthetic' },
      '/planning/assignments/0': { kind: 'teacher-entered' },
      '/planning/assignments/1': { kind: 'teacher-entered' },
      '/derived/example': { kind: 'derived', derivedFrom: ['/students/0/metrics/score'] },
    },
    extensions: { preserved: { version: 1 } },
  }
}

describe('EduBoard hand-back v1', () => {
  it('maps approved grid seating to EduBoard zero-based row/col coordinates', () => {
    const handback = buildEduBoardHandback(fixtureProject())

    expect(handback.compatibility).toEqual({
      targetApplication: 'EduBoard',
      targetContractVersion: '1',
      requiresExplicitClassSelection: true,
      studentIdMapping: 'exact-id-only',
      seatCoordinates: 'zero-based-row-col',
    })
    expect(handback.approvedPlanning.seatAssignments).toEqual([
      {
        studentId: 'edu-student-1',
        seatId: 'seat-r1-c1',
        row: 0,
        col: 0,
        locked: true,
      },
      {
        studentId: 'edu-student-2',
        seatId: 'seat-r2-c2',
        row: 1,
        col: 1,
        locked: false,
      },
    ])
  })

  it('never exposes synthetic or derived values as source-safe fields', () => {
    const handback = buildEduBoardHandback(fixtureProject())
    const paths = handback.sourceData.sourceFieldValues.map((item) => item.path)

    expect(paths).toContain('/students/0/metrics/score')
    expect(paths).not.toContain('/students/1/metrics/score')
    expect(paths).not.toContain('/derived/example')
    expect(handback.syntheticPaths).toContain('/students/1/metrics/score')
    expect(handback.derivedPaths).toContain('/derived/example')
  })

  it('preserves ClassGraph extensions explicitly rather than interpreting them', () => {
    expect(buildEduBoardHandback(fixtureProject()).extensions).toEqual({
      preserved: { version: 1 },
    })
  })

  it('serializes deterministically and requires explicit EduBoard class selection', () => {
    const project = fixtureProject()
    expect(serializeEduBoardHandback(project)).toBe(serializeEduBoardHandback(project))
    expect(buildEduBoardHandback(project).compatibility.requiresExplicitClassSelection).toBe(true)
  })

  it('validates the checked-in representative hand-back fixture', async () => {
    const input = await readFile('tests/fixtures/eduboard-handback-v1.json', 'utf8')
    const parsed = parseEduBoardHandbackJson(input)
    expect(parsed.format).toBe('classgraph-eduboard-handback')
    expect(parsed.version).toBe('1.0')
    expect(parsed.compatibility.seatCoordinates).toBe('zero-based-row-col')
  })
})
