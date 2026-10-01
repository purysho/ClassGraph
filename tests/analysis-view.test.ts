import { describe, expect, it } from 'vitest'
import { buildProjectAnalysis, buildScatterView } from '../src/analysis-view.js'
import { addMetricDefinition, setStudentMetricValue } from '../src/metrics.js'
import { addStudent, createEmptyProject } from '../src/workspace.js'

const t0 = '2026-10-01T10:00:00.000Z'

function analysisProject() {
  let project = createEmptyProject({
    projectId: 'analysis-class',
    title: 'Analysis Class',
    now: t0,
  })
  project = addStudent(project, { id: 's1', displayName: 'One' }, t0)
  project = addStudent(project, { id: 's2', displayName: 'Two' }, t0)
  project = addStudent(project, { id: 's3', displayName: 'Three' }, t0)
  project = addMetricDefinition(
    project,
    { key: 'x', label: 'Metric X', kind: 'number' },
    t0,
  )
  project = addMetricDefinition(
    project,
    { key: 'y', label: 'Metric Y', kind: 'number' },
    t0,
  )
  project = addMetricDefinition(
    project,
    {
      key: 'group',
      label: 'Group',
      kind: 'category',
      categories: ['A', 'B'],
    },
    t0,
  )
  project = setStudentMetricValue(project, 's1', 'x', 0, t0)
  project = setStudentMetricValue(project, 's1', 'y', 10, t0)
  project = setStudentMetricValue(project, 's1', 'group', 'A', t0)
  project = setStudentMetricValue(project, 's2', 'x', 5, t0)
  project = setStudentMetricValue(project, 's2', 'y', 15, t0)
  project = setStudentMetricValue(project, 's2', 'group', null, t0)
  project = setStudentMetricValue(project, 's3', 'x', null, t0)
  return project
}

describe('analysis view models', () => {
  it('separates recorded, explicit missing, and unrecorded cells', () => {
    const analysis = buildProjectAnalysis(analysisProject())

    expect(analysis.completeness).toEqual({
      totalCells: 9,
      recordedCount: 5,
      explicitMissingCount: 2,
      unrecordedCount: 2,
    })
  })

  it('builds deterministic histogram counts without losing zero', () => {
    const analysis = buildProjectAnalysis(analysisProject())
    const x = analysis.metrics.find((metric) => metric.key === 'x')

    expect(x?.kind).toBe('number')
    if (x?.kind !== 'number') return
    expect(x.summary.recordedCount).toBe(2)
    expect(x.summary.min).toBe(0)
    expect(x.histogram.reduce((sum, bucket) => sum + bucket.count, 0)).toBe(2)
  })

  it('builds scatter points only when both numeric values are recorded', () => {
    const scatter = buildScatterView(analysisProject(), 'x', 'y')

    expect(scatter.points).toEqual([
      { studentId: 's1', displayName: 'One', x: 0, y: 10 },
      { studentId: 's2', displayName: 'Two', x: 5, y: 15 },
    ])
    expect(scatter.omittedCount).toBe(1)
  })

  it('rejects non-numeric scatter axes', () => {
    expect(() => buildScatterView(analysisProject(), 'group', 'y')).toThrow('CG-3004')
  })
})
