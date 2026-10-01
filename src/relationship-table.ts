import type {
  ClassGraphProject,
  ProvenanceEntry,
  RelationshipRecord,
  RelationshipType,
} from './model.js'
import { relationshipIsDirected } from './relationship-semantics.js'

export type RelationshipTableFilter = RelationshipType | 'all'

export interface RelationshipTableRow {
  index: number
  id: string
  fromStudentId: string
  fromDisplayName?: string
  toStudentId: string
  toDisplayName?: string
  type: RelationshipType
  label?: string
  directed: boolean
  weight?: number
  provenance?: ProvenanceEntry
}

function relationshipProvenance(
  project: ClassGraphProject,
  index: number,
): ProvenanceEntry | undefined {
  const basePath = `/relationships/${index}`
  const direct = project.provenance[basePath]
  if (direct) return direct

  const nested = Object.entries(project.provenance)
    .filter(([path]) => path.startsWith(`${basePath}/`))
    .sort(([left], [right]) => left.localeCompare(right))[0]

  return nested?.[1]
}

export function buildRelationshipTable(
  project: ClassGraphProject,
  filter: RelationshipTableFilter = 'all',
): RelationshipTableRow[] {
  const students = new Map(project.students.map((student) => [student.id, student]))

  return (project.relationships ?? [])
    .map((relationship: RelationshipRecord, index): RelationshipTableRow => {
      const from = students.get(relationship.fromStudentId)
      const to = students.get(relationship.toStudentId)

      return {
        index,
        id: relationship.id,
        fromStudentId: relationship.fromStudentId,
        ...(from?.displayName ? { fromDisplayName: from.displayName } : {}),
        toStudentId: relationship.toStudentId,
        ...(to?.displayName ? { toDisplayName: to.displayName } : {}),
        type: relationship.type,
        ...(relationship.label ? { label: relationship.label } : {}),
        directed: relationshipIsDirected(relationship),
        ...(relationship.weight !== undefined ? { weight: relationship.weight } : {}),
        ...(relationshipProvenance(project, index)
          ? { provenance: relationshipProvenance(project, index) }
          : {}),
      }
    })
    .filter((row) => filter === 'all' || row.type === filter)
}
