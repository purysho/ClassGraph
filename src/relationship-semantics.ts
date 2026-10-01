import type { RelationshipRecord } from './model.js'

export function relationshipIsDirected(relationship: RelationshipRecord): boolean {
  return relationship.directed ?? false
}

export function canonicalRelationshipKey(relationship: RelationshipRecord): string {
  const directed = relationshipIsDirected(relationship)
  let fromStudentId = relationship.fromStudentId
  let toStudentId = relationship.toStudentId

  if (!directed && fromStudentId.localeCompare(toStudentId) > 0) {
    ;[fromStudentId, toStudentId] = [toStudentId, fromStudentId]
  }

  const customLabel = relationship.type === 'custom' ? relationship.label?.trim() ?? '' : ''

  return JSON.stringify([
    relationship.type,
    directed,
    fromStudentId,
    toStudentId,
    customLabel,
  ])
}
