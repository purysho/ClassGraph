import type { PlanningGroup, RelationshipRecord, RelationshipType } from './model.js'

export interface GroupNetworkSummary {
  groupCount: number
  totalExplicitEdges: number
  withinGroupEdges: number
  acrossGroupEdges: number
  ungroupedEdges: number
  byType: Partial<Record<RelationshipType, number>>
  betweenGroupPairs: Record<string, number>
}

export interface NetworkCountComparison {
  key: string
  label: string
  left: number
  right: number
  delta: number
}

export interface GroupNetworkComparison {
  left: GroupNetworkSummary
  right: GroupNetworkSummary
  counts: NetworkCountComparison[]
  byType: NetworkCountComparison[]
}

function membership(groups: PlanningGroup[]): Map<string, string> {
  const result = new Map<string, string>()
  for (const group of groups) {
    for (const studentId of group.studentIds) result.set(studentId, group.id)
  }
  return result
}

function increment(record: Record<string, number>, key: string): void {
  record[key] = (record[key] ?? 0) + 1
}

export function summarizeGroupNetwork(
  relationships: RelationshipRecord[],
  groups: PlanningGroup[],
): GroupNetworkSummary {
  const groupByStudent = membership(groups)
  const byType: Partial<Record<RelationshipType, number>> = {}
  const betweenGroupPairs: Record<string, number> = {}
  let withinGroupEdges = 0
  let acrossGroupEdges = 0
  let ungroupedEdges = 0

  for (const relationship of relationships) {
    byType[relationship.type] = (byType[relationship.type] ?? 0) + 1

    const fromGroup = groupByStudent.get(relationship.fromStudentId)
    const toGroup = groupByStudent.get(relationship.toStudentId)

    if (!fromGroup || !toGroup) {
      ungroupedEdges += 1
      continue
    }

    if (fromGroup === toGroup) {
      withinGroupEdges += 1
      continue
    }

    acrossGroupEdges += 1
    const pair = [fromGroup, toGroup].sort((left, right) => left.localeCompare(right)).join(' ↔ ')
    increment(betweenGroupPairs, pair)
  }

  return {
    groupCount: groups.length,
    totalExplicitEdges: relationships.length,
    withinGroupEdges,
    acrossGroupEdges,
    ungroupedEdges,
    byType,
    betweenGroupPairs,
  }
}

function comparison(
  key: string,
  label: string,
  left: number,
  right: number,
): NetworkCountComparison {
  return { key, label, left, right, delta: right - left }
}

export function compareGroupNetworks(
  relationships: RelationshipRecord[],
  leftGroups: PlanningGroup[],
  rightGroups: PlanningGroup[],
): GroupNetworkComparison {
  const left = summarizeGroupNetwork(relationships, leftGroups)
  const right = summarizeGroupNetwork(relationships, rightGroups)

  const counts = [
    comparison('groups', 'Groups', left.groupCount, right.groupCount),
    comparison(
      'total-explicit-edges',
      'Total explicit edges',
      left.totalExplicitEdges,
      right.totalExplicitEdges,
    ),
    comparison(
      'within-group',
      'Edges within groups',
      left.withinGroupEdges,
      right.withinGroupEdges,
    ),
    comparison(
      'across-groups',
      'Edges across groups',
      left.acrossGroupEdges,
      right.acrossGroupEdges,
    ),
    comparison(
      'ungrouped',
      'Edges with an ungrouped endpoint',
      left.ungroupedEdges,
      right.ungroupedEdges,
    ),
  ]

  const types: RelationshipType[] = [
    'works-well-with',
    'avoid-pairing',
    'support-pair',
    'friendship',
    'custom',
  ]
  const byType = types.map((type) =>
    comparison(type, type, left.byType[type] ?? 0, right.byType[type] ?? 0),
  )

  return { left, right, counts, byType }
}
