import { describe, expect, it } from 'vitest'
import type { PlanningGroup, RelationshipRecord } from '../src/model.js'
import { compareGroupNetworks, summarizeGroupNetwork } from '../src/network-comparison.js'

const relationships: RelationshipRecord[] = [
  { id: 'r1', fromStudentId: 's1', toStudentId: 's2', type: 'works-well-with' },
  { id: 'r2', fromStudentId: 's1', toStudentId: 's3', type: 'support-pair' },
  { id: 'r3', fromStudentId: 's4', toStudentId: 's5', type: 'avoid-pairing' },
  { id: 'r4', fromStudentId: 's2', toStudentId: 's4', type: 'support-pair' },
]

const left: PlanningGroup[] = [
  { id: 'g1', studentIds: ['s1', 's2'] },
  { id: 'g2', studentIds: ['s3', 's4'] },
]

const right: PlanningGroup[] = [
  { id: 'g1', studentIds: ['s1', 's3'] },
  { id: 'g2', studentIds: ['s2', 's4'] },
]

describe('group relationship network summaries', () => {
  it('counts explicit edges without assigning educational value', () => {
    const summary = summarizeGroupNetwork(relationships, left)

    expect(summary).toMatchObject({
      groupCount: 2,
      totalExplicitEdges: 4,
      withinGroupEdges: 1,
      acrossGroupEdges: 2,
      ungroupedEdges: 1,
      byType: {
        'works-well-with': 1,
        'support-pair': 2,
        'avoid-pairing': 1,
      },
    })
  })

  it('reports before/after count deltas without a winner or composite score', () => {
    const result = compareGroupNetworks(relationships, left, right)

    expect(result.counts.find((item) => item.key === 'within-group')).toMatchObject({
      left: 1,
      right: 2,
      delta: 1,
    })
    expect(result).not.toHaveProperty('score')
    expect(result).not.toHaveProperty('winner')
  })

  it('uses only supplied relationships and groups', () => {
    const summary = summarizeGroupNetwork([], left)

    expect(summary.totalExplicitEdges).toBe(0)
    expect(summary.withinGroupEdges).toBe(0)
    expect(summary.acrossGroupEdges).toBe(0)
  })
})
