import { describe, expect, it } from 'vitest'
import {
  ASSOCIATION_CAVEAT,
  buildCrossTab,
  buildGroupSummary,
  computePearsonAssociation,
} from '../src/analysis-compare.js'
import { buildScatterView } from '../src/analysis-view.js'
import { dispatchClassGraphApi } from '../src/api-dispatch.js'
import { addMetricDefinition, setStudentMetricValue } from '../src/metrics.js'
import type { ClassGraphProject } from '../src/model.js'
import { addStudent, createEmptyProject } from '../src/workspace.js'

const t0 = '2026-10-06T10:00:00.000Z'

function compareProject(): ClassGraphProject {
  let project = createEmptyProject({ projectId: 'compare', title: 'Compare', now: t0 })
  project = addStudent(project, { id: 's1', tags: ['blue', 'red'] }, t0)
  project = addStudent(project, { id: 's2', tags: ['blue'] }, t0)
  project = addStudent(project, { id: 's3' }, t0)
  project = addStudent(project, { id: 's4', tags: ['red'] }, t0)
  project = addMetricDefinition(
    project,
    { key: 'support', label: 'Language support', kind: 'category', categories: ['more', 'less'] },
    t0,
  )
  project = addMetricDefinition(
    project,
    {
      key: 'confidence',
      label: 'Confidence',
      kind: 'ordinal',
      ordinalScale: ['low', 'mid', 'high'],
    },
    t0,
  )
  project = addMetricDefinition(project, { key: 'speaker', label: 'Speaker', kind: 'boolean' }, t0)
  project = addMetricDefinition(project, { key: 'score', label: 'Score', kind: 'number' }, t0)
  project = addMetricDefinition(project, { key: 'note', label: 'Note', kind: 'text' }, t0)

  project = setStudentMetricValue(project, 's1', 'support', 'more', t0)
  project = setStudentMetricValue(project, 's2', 'support', 'less', t0)
  project = setStudentMetricValue(project, 's3', 'support', null, t0)
  project = setStudentMetricValue(project, 's4', 'support', 'more', t0)

  project = setStudentMetricValue(project, 's1', 'confidence', 'high', t0)
  project = setStudentMetricValue(project, 's2', 'confidence', 'low', t0)
  project = setStudentMetricValue(project, 's4', 'confidence', 'high', t0)

  project = setStudentMetricValue(project, 's1', 'speaker', true, t0)
  project = setStudentMetricValue(project, 's2', 'speaker', false, t0)
  project = setStudentMetricValue(project, 's3', 'speaker', false, t0)

  project = setStudentMetricValue(project, 's1', 'score', 0, t0)
  project = setStudentMetricValue(project, 's2', 'score', 10, t0)
  project = setStudentMetricValue(project, 's3', 'score', null, t0)
  project = setStudentMetricValue(project, 's4', 'score', 20, t0)
  return project
}

describe('cross-tabulation', () => {
  it('counts students by two selected levelled metrics in authored order', () => {
    const view = buildCrossTab(compareProject(), 'support', 'confidence')

    expect(view.rows.map((level) => level.label)).toEqual(['more', 'less', 'Missing'])
    expect(view.columns.map((level) => level.label)).toEqual(['low', 'mid', 'high', 'Not recorded'])
    expect(view.counts).toEqual([
      [0, 0, 2, 0],
      [1, 0, 0, 0],
      [0, 0, 0, 1],
    ])
    expect(view.rowTotals).toEqual([2, 1, 1])
    expect(view.columnTotals).toEqual([1, 0, 2, 1])
    expect(view.studentCount).toBe(4)
    expect(view.bothRecordedCount).toBe(3)
  })

  it('keeps explicit missing and not-recorded values as separate levels', () => {
    const view = buildCrossTab(compareProject(), 'speaker', 'support')

    expect(view.rows.map((level) => [level.label, level.state])).toEqual([
      ['Yes', 'recorded'],
      ['No', 'recorded'],
      ['Not recorded', 'not-recorded'],
    ])
    expect(view.columns.at(-1)).toEqual({ key: '__missing__', label: 'Missing', state: 'missing' })
    // false is a recorded value, never treated as missing
    expect(view.rowTotals[1]).toBe(2)
  })

  it('never drops an undeclared value from an unvalidated in-memory project', () => {
    const project = compareProject()
    const students = project.students.map((student) =>
      student.id === 's3'
        ? { ...student, metrics: { ...student.metrics, support: 'zeta' } }
        : student,
    )
    const view = buildCrossTab({ ...project, students }, 'support', 'speaker')

    expect(view.rows.map((level) => level.label)).toEqual(['more', 'less', 'zeta'])
    expect(view.rowTotals.reduce((sum, value) => sum + value, 0)).toBe(4)
  })

  it('rejects numeric, text, unknown, or identical metrics', () => {
    const project = compareProject()
    expect(() => buildCrossTab(project, 'score', 'support')).toThrow('CG-3006')
    expect(() => buildCrossTab(project, 'support', 'note')).toThrow('CG-3006')
    expect(() => buildCrossTab(project, 'support', 'nope')).toThrow('CG-3001')
    expect(() => buildCrossTab(project, 'support', 'support')).toThrow('CG-3007')
  })
})

describe('numeric association', () => {
  it('reports Pearson r with a direction and the non-causation caveat', () => {
    const perfect = computePearsonAssociation([
      { x: 1, y: 2 },
      { x: 2, y: 4 },
      { x: 3, y: 6 },
    ])
    expect(perfect).toEqual({
      method: 'pearson',
      pairCount: 3,
      coefficient: 1,
      direction: 'positive',
      caveat: ASSOCIATION_CAVEAT,
    })

    const inverse = computePearsonAssociation([
      { x: 1, y: 3 },
      { x: 2, y: 2 },
      { x: 3, y: 1 },
      { x: 4, y: 1 },
    ])
    expect(inverse.direction).toBe('negative')
    expect(inverse.coefficient).toBeCloseTo(-0.944, 3)
  })

  it('withholds a coefficient when there are too few pairs or no variation', () => {
    expect(
      computePearsonAssociation([
        { x: 1, y: 1 },
        { x: 2, y: 2 },
      ]),
    ).toMatchObject({ coefficient: null, unavailableReason: 'too-few-pairs', pairCount: 2 })
    expect(
      computePearsonAssociation([
        { x: 5, y: 1 },
        { x: 5, y: 2 },
        { x: 5, y: 3 },
      ]),
    ).toMatchObject({ coefficient: null, unavailableReason: 'no-variation' })
  })

  it('is attached to scatter views using only pairwise-recorded students', () => {
    let project = compareProject()
    project = addMetricDefinition(project, { key: 'other', label: 'Other', kind: 'number' }, t0)
    project = setStudentMetricValue(project, 's1', 'other', 1, t0)
    project = setStudentMetricValue(project, 's2', 'other', 2, t0)
    project = setStudentMetricValue(project, 's3', 'other', 3, t0)
    project = setStudentMetricValue(project, 's4', 'other', 3, t0)

    const scatter = buildScatterView(project, 'score', 'other')
    expect(scatter.omittedCount).toBe(1)
    expect(scatter.association.pairCount).toBe(3)
    expect(scatter.association.coefficient).toBe(1)
  })
})

describe('summaries by tag or planning group', () => {
  it('summarises a numeric metric per tag without imputing missing values', () => {
    const view = buildGroupSummary(compareProject(), 'score', 'tag')

    expect(view.metricKind).toBe('number')
    if (view.metricKind !== 'number') return
    expect(view.overlapping).toBe(true)
    expect(
      view.segments.map((item) => [
        item.segment.label,
        item.segment.studentCount,
        item.recordedCount,
        item.missingCount,
        item.mean,
      ]),
    ).toEqual([
      ['blue', 2, 2, 0, 5],
      ['red', 2, 2, 0, 10],
      ['No tags', 1, 0, 1, null],
    ])
    expect(view.segments.at(-1)?.segment.remainder).toBe(true)
  })

  it('counts levelled metric values per planning group', () => {
    const project: ClassGraphProject = {
      ...compareProject(),
      planning: {
        groups: [
          { id: 'g1', label: 'Table 1', studentIds: ['s1', 's2', 'ghost'] },
          { id: 'g2', studentIds: ['s4'] },
        ],
      },
    }
    const view = buildGroupSummary(project, 'confidence', 'planning-group')

    expect(view.metricKind).toBe('ordinal')
    if (view.metricKind === 'number') return
    expect(view.overlapping).toBe(false)
    expect(view.levels.map((level) => level.label)).toEqual(['low', 'mid', 'high', 'Not recorded'])
    expect(view.segments.map((item) => [item.segment.label, item.counts])).toEqual([
      ['Table 1', [1, 0, 1, 0]],
      ['g2', [0, 0, 1, 0]],
      ['Not in a group', [0, 0, 0, 1]],
    ])
  })

  it('rejects free-text metrics', () => {
    expect(() => buildGroupSummary(compareProject(), 'note', 'tag')).toThrow('CG-3008')
  })
})

function parseBody(response: {
  body?: unknown
}): Record<string, Record<string, unknown> | undefined> {
  return JSON.parse(response.body as string) as Record<string, Record<string, unknown> | undefined>
}

describe('comparison API routes', () => {
  it('serves cross-tabs and group summaries with validated input', async () => {
    const project = compareProject()
    const crossTab = await dispatchClassGraphApi({
      method: 'POST',
      path: '/api/analysis/crosstab',
      body: JSON.stringify({ project, rowMetricKey: 'support', columnMetricKey: 'speaker' }),
    })
    expect(crossTab.status).toBe(200)
    expect(parseBody(crossTab).crossTab?.bothRecordedCount).toBe(2)

    const summary = await dispatchClassGraphApi({
      method: 'POST',
      path: '/api/analysis/group-summary',
      body: JSON.stringify({ project, metricKey: 'score', basis: 'tag' }),
    })
    expect(summary.status).toBe(200)
    expect(parseBody(summary).groupSummary?.segments).toHaveLength(3)

    const badBasis = await dispatchClassGraphApi({
      method: 'POST',
      path: '/api/analysis/group-summary',
      body: JSON.stringify({ project, metricKey: 'score', basis: 'seat' }),
    })
    expect(badBasis.status).toBe(400)
    expect(parseBody(badBasis).error?.code).toBe('CG-1001')

    const badMetric = await dispatchClassGraphApi({
      method: 'POST',
      path: '/api/analysis/crosstab',
      body: JSON.stringify({ project, rowMetricKey: 'score', columnMetricKey: 'support' }),
    })
    expect(parseBody(badMetric).error?.code).toBe('CG-3006')
  })
})
