import { describe, expect, it } from 'vitest'
import { addStudent, createEmptyProject } from '../src/workspace.js'
import {
  addMetricDefinition,
  removeMetricDefinition,
  setStudentMetricValue,
  unsetStudentMetricValue,
  updateMetricDefinition,
} from '../src/metrics.js'

const t0 = '2026-10-01T10:00:00.000Z'
const t1 = '2026-10-01T10:01:00.000Z'
const t2 = '2026-10-01T10:02:00.000Z'
const t3 = '2026-10-01T10:03:00.000Z'

function projectWithStudent() {
  const project = createEmptyProject({
    projectId: 'class-5a',
    title: 'Grade 5A',
    now: t0,
  })
  return addStudent(project, { id: 's-001', displayName: 'Student One' }, t1)
}

describe('metric editing', () => {
  it('adds a metric definition with teacher-entered provenance', () => {
    const project = addMetricDefinition(
      projectWithStudent(),
      {
        key: 'assessment',
        label: 'Assessment',
        kind: 'number',
        numberScale: { min: 0, max: 100 },
      },
      t2,
    )

    expect(project.metricDefinitions[0]?.key).toBe('assessment')
    expect(project.provenance['/metricDefinitions/0']?.kind).toBe('teacher-entered')
  })

  it('preserves zero, false and explicit missing null as distinct values', () => {
    let project = projectWithStudent()
    project = addMetricDefinition(
      project,
      { key: 'score', label: 'Score', kind: 'number' },
      t2,
    )
    project = addMetricDefinition(
      project,
      { key: 'present', label: 'Present', kind: 'boolean' },
      t2,
    )

    project = setStudentMetricValue(project, 's-001', 'score', 0, t3)
    project = setStudentMetricValue(project, 's-001', 'present', false, t3)

    expect(project.students[0]?.metrics.score).toBe(0)
    expect(project.students[0]?.metrics.present).toBe(false)

    project = setStudentMetricValue(project, 's-001', 'score', null, t3)
    expect(project.students[0]?.metrics.score).toBeNull()
    expect(project.provenance['/students/0/metrics/score']?.kind).toBe('teacher-entered')
  })

  it('can remove an unrecorded value without converting it to null', () => {
    let project = projectWithStudent()
    project = addMetricDefinition(
      project,
      { key: 'score', label: 'Score', kind: 'number' },
      t2,
    )
    project = setStudentMetricValue(project, 's-001', 'score', null, t3)
    project = unsetStudentMetricValue(project, 's-001', 'score', t3)

    expect('score' in (project.students[0]?.metrics ?? {})).toBe(false)
    expect(project.provenance['/students/0/metrics/score']).toBeUndefined()
  })

  it('rejects values that do not match the metric definition', () => {
    let project = projectWithStudent()
    project = addMetricDefinition(
      project,
      {
        key: 'support',
        label: 'Support',
        kind: 'category',
        categories: ['low', 'high'],
      },
      t2,
    )

    expect(() => setStudentMetricValue(project, 's-001', 'support', 'medium', t3)).toThrow()
  })

  it('rejects null when a metric explicitly disallows missing values', () => {
    let project = projectWithStudent()
    project = addMetricDefinition(
      project,
      { key: 'required', label: 'Required', kind: 'number', missingAllowed: false },
      t2,
    )

    expect(() => setStudentMetricValue(project, 's-001', 'required', null, t3)).toThrow()
  })

  it('updates definitions safely and removes metric data when the definition is removed', () => {
    let project = projectWithStudent()
    project = addMetricDefinition(
      project,
      { key: 'score', label: 'Score', kind: 'number' },
      t2,
    )
    project = setStudentMetricValue(project, 's-001', 'score', 80, t3)
    project = updateMetricDefinition(
      project,
      'score',
      { key: 'score', label: 'Assessment score', kind: 'number', numberScale: { max: 100 } },
      t3,
    )
    expect(project.metricDefinitions[0]?.label).toBe('Assessment score')

    project = removeMetricDefinition(project, 'score', t3)
    expect(project.metricDefinitions).toEqual([])
    expect(project.students[0]?.metrics).toEqual({})
    expect(project.provenance['/students/0/metrics/score']).toBeUndefined()
  })
})
