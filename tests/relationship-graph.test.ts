import { describe, expect, it } from 'vitest'
import type { ClassGraphProject } from '../src/model.js'
import { buildRelationshipGraph } from '../src/relationship-graph.js'

function project(): ClassGraphProject {
  return {
    schemaVersion: '1.0',
    projectId: 'relationship-graph',
    title: 'Relationship Graph',
    createdAt: '2026-10-02T00:00:00.000Z',
    updatedAt: '2026-10-02T00:00:00.000Z',
    classInfo: {},
    metricDefinitions: [],
    students: [
      { id: 's3', displayName: 'Three', metrics: {} },
      { id: 's1', displayName: 'One', metrics: {} },
      { id: 's2', displayName: 'Two', metrics: {} },
      { id: 's4', displayName: 'Four', metrics: {} },
    ],
    relationships: [
      {
        id: 'r1',
        fromStudentId: 's1',
        toStudentId: 's2',
        type: 'support-pair',
        directed: true,
      },
      {
        id: 'r2',
        fromStudentId: 's3',
        toStudentId: 's1',
        type: 'works-well-with',
      },
    ],
    provenance: {
      '/relationships/0': { kind: 'teacher-entered', source: 'manual-relationship-entry' },
      '/relationships/1': { kind: 'synthetic', source: 'fixture' },
    },
  }
}

describe('relationship graph', () => {
  it('produces the same layout from the same explicit data', () => {
    expect(buildRelationshipGraph(project())).toEqual(buildRelationshipGraph(project()))
  })

  it('orders students deterministically rather than by roster order', () => {
    expect(buildRelationshipGraph(project()).nodes.map((node) => node.studentId)).toEqual([
      's1',
      's2',
      's3',
      's4',
    ])
  })

  it('places a valid focus student at the centre and explicit neighbours on the inner ring', () => {
    const graph = buildRelationshipGraph(project(), 's1')
    const focus = graph.nodes.find((node) => node.studentId === 's1')
    const s2 = graph.nodes.find((node) => node.studentId === 's2')
    const s3 = graph.nodes.find((node) => node.studentId === 's3')
    const s4 = graph.nodes.find((node) => node.studentId === 's4')

    expect(focus).toMatchObject({ x: 0.5, y: 0.5, focused: true })
    expect(s2?.connectedToFocus).toBe(true)
    expect(s3?.connectedToFocus).toBe(true)
    expect(s4?.connectedToFocus).toBe(false)
  })

  it('uses only stored relationship records as edges and retains provenance', () => {
    const graph = buildRelationshipGraph(project())

    expect(graph.edges).toHaveLength(2)
    expect(graph.edges.map((edge) => edge.relationshipId)).toEqual(['r1', 'r2'])
    expect(graph.edges[0]).toMatchObject({
      fromStudentId: 's1',
      toStudentId: 's2',
      directed: true,
      provenance: { kind: 'teacher-entered' },
    })
    expect(graph.edges[1]?.provenance?.kind).toBe('synthetic')
  })

  it('does not change when unrelated student metrics change', () => {
    const baseline = project()
    const changed = project()
    changed.metricDefinitions = [{ key: 'score', label: 'Score', kind: 'number' }]
    changed.students[0]!.metrics.score = 3
    changed.students[1]!.metrics.score = 99

    expect(buildRelationshipGraph(changed, 's1')).toEqual(buildRelationshipGraph(baseline, 's1'))
  })

  it('ignores an unknown focus rather than inventing a node', () => {
    const graph = buildRelationshipGraph(project(), 'missing')

    expect(graph.focusStudentId).toBeUndefined()
    expect(graph.nodes.some((node) => node.focused)).toBe(false)
  })
})
