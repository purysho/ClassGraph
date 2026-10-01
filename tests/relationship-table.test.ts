import { describe, expect, it } from 'vitest'
import type { ClassGraphProject } from '../src/model.js'
import { buildRelationshipTable } from '../src/relationship-table.js'

function project(): ClassGraphProject {
  return {
    schemaVersion: '1.0',
    projectId: 'relationship-table',
    title: 'Relationship Table',
    createdAt: '2026-10-02T00:00:00.000Z',
    updatedAt: '2026-10-02T00:00:00.000Z',
    classInfo: {},
    metricDefinitions: [],
    students: [
      { id: 's1', displayName: 'One', metrics: {} },
      { id: 's2', displayName: 'Two', metrics: {} },
      { id: 's3', metrics: {} },
    ],
    relationships: [
      {
        id: 'r1',
        fromStudentId: 's1',
        toStudentId: 's2',
        type: 'works-well-with',
      },
      {
        id: 'r2',
        fromStudentId: 's2',
        toStudentId: 's3',
        type: 'support-pair',
        directed: true,
        label: 'Reading',
        weight: 2,
      },
    ],
    provenance: {
      '/relationships/0': { kind: 'teacher-entered', source: 'manual-relationship-entry' },
      '/relationships/1/type': { kind: 'imported', source: 'fixture' },
    },
  }
}

describe('relationship table model', () => {
  it('keeps stored order and exposes labels, direction and provenance', () => {
    const rows = buildRelationshipTable(project())

    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({
      index: 0,
      id: 'r1',
      fromStudentId: 's1',
      fromDisplayName: 'One',
      toStudentId: 's2',
      toDisplayName: 'Two',
      directed: false,
      provenance: { kind: 'teacher-entered' },
    })
    expect(rows[1]).toMatchObject({
      id: 'r2',
      label: 'Reading',
      directed: true,
      weight: 2,
      provenance: { kind: 'imported', source: 'fixture' },
    })
  })

  it('filters only by explicit relationship type', () => {
    expect(buildRelationshipTable(project(), 'support-pair').map((row) => row.id)).toEqual(['r2'])
    expect(buildRelationshipTable(project(), 'friendship')).toEqual([])
  })

  it('does not inspect student metrics to create rows', () => {
    const source = project()
    source.students[0]!.metrics = { score: 100 }
    source.students[1]!.metrics = { score: 0 }
    source.metricDefinitions = [{ key: 'score', label: 'Score', kind: 'number' }]

    expect(buildRelationshipTable(source)).toHaveLength(2)
  })
})
