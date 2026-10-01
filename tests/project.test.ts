import { describe, expect, it } from 'vitest'
import {
  addMetricDefinition,
  addStudent,
  makeMetricDefinition,
  parseManualValue,
  removeStudent,
} from '../src/app/project.js'
import type { ClassGraphProject } from '../src/model.js'

function project(): ClassGraphProject {
  return {
    schemaVersion: '1.0',
    projectId: 'manual',
    title: 'Manual',
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    classInfo: {},
    metricDefinitions: [],
    students: [],
    provenance: {},
  }
}

describe('editable project helpers', () => {
  it('adds a metric to existing students without inventing a value', () => {
    const withStudent = addStudent(project())
    const definition = makeMetricDefinition('score', 'Score', 'number')
    const next = addMetricDefinition(withStudent, definition)

    expect(next.metricDefinitions).toEqual([definition])
    expect(next.students[0]?.metrics.score).toBeNull()
  })

  it('adds students with all current metrics set to missing', () => {
    const withMetric = addMetricDefinition(
      project(),
      makeMetricDefinition('participation', 'Participation', 'ordinal', 'Low, Medium, High'),
    )
    const next = addStudent(withMetric)

    expect(next.students[0]?.metrics.participation).toBeNull()
    expect(next.students[0]?.id).toBe('student-001')
  })

  it('removes only the selected student', () => {
    const first = addStudent(project())
    const second = addStudent(first)
    const next = removeStudent(second, 0)

    expect(next.students).toHaveLength(1)
    expect(next.students[0]?.id).toBe('student-002')
  })

  it('keeps blank manual input as missing data', () => {
    const definition = makeMetricDefinition('score', 'Score', 'number')
    expect(parseManualValue(definition, '')).toBeNull()
    expect(parseManualValue(definition, '0')).toBe(0)
  })
})
