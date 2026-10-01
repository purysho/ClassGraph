import type {
  ClassGraphProject,
  ProvenanceEntry,
  RelationshipRecord,
  RelationshipType,
} from './model.js'
import { canonicalRelationshipKey } from './relationship-semantics.js'
import { classGraphProjectSchema } from './schema.js'

export interface RelationshipPatch {
  fromStudentId?: string
  toStudentId?: string
  type?: RelationshipType
  label?: string | null
  directed?: boolean | null
  weight?: number | null
}

function teacherEntered(source: string): ProvenanceEntry {
  return { kind: 'teacher-entered', source }
}

function cloneProject(project: ClassGraphProject): ClassGraphProject {
  return structuredClone(project)
}

function validate(project: ClassGraphProject): ClassGraphProject {
  return classGraphProjectSchema.parse(project)
}

function normalizeRelationship(relationship: RelationshipRecord): RelationshipRecord {
  const id = relationship.id.trim()
  const fromStudentId = relationship.fromStudentId.trim()
  const toStudentId = relationship.toStudentId.trim()
  const label = relationship.label?.trim()

  if (!id) throw new Error('CG-2020 relationship id must not be empty')
  if (!fromStudentId || !toStudentId) {
    throw new Error('CG-2021 relationship student ids must not be empty')
  }

  return {
    id,
    fromStudentId,
    toStudentId,
    type: relationship.type,
    ...(label ? { label } : {}),
    ...(relationship.directed !== undefined ? { directed: relationship.directed } : {}),
    ...(relationship.weight !== undefined ? { weight: relationship.weight } : {}),
  }
}

function assertRelationshipEndpoints(project: ClassGraphProject, relationship: RelationshipRecord): void {
  const studentIds = new Set(project.students.map((student) => student.id))
  if (!studentIds.has(relationship.fromStudentId)) {
    throw new Error(`CG-2021 unknown relationship student: ${relationship.fromStudentId}`)
  }
  if (!studentIds.has(relationship.toStudentId)) {
    throw new Error(`CG-2021 unknown relationship student: ${relationship.toStudentId}`)
  }
  if (relationship.fromStudentId === relationship.toStudentId) {
    throw new Error('CG-2022 relationship endpoints must be different students')
  }
}

function assertNoSemanticDuplicate(
  project: ClassGraphProject,
  relationship: RelationshipRecord,
  ignoreId?: string,
): void {
  const key = canonicalRelationshipKey(relationship)
  const duplicate = (project.relationships ?? []).find(
    (item) => item.id !== ignoreId && canonicalRelationshipKey(item) === key,
  )
  if (duplicate) {
    throw new Error(
      `CG-2023 duplicate relationship semantics: ${relationship.id} conflicts with ${duplicate.id}`,
    )
  }
}

function clearRelationshipProvenanceAtIndex(project: ClassGraphProject, index: number): void {
  const prefix = `/relationships/${index}`
  for (const path of Object.keys(project.provenance)) {
    if (path === prefix || path.startsWith(`${prefix}/`)) delete project.provenance[path]
  }
}

function remapRelationshipProvenanceAfterRemoval(
  provenance: ClassGraphProject['provenance'],
  removedIndex: number,
): ClassGraphProject['provenance'] {
  const result: ClassGraphProject['provenance'] = {}

  for (const [path, entry] of Object.entries(provenance)) {
    const match = /^\/relationships\/(\d+)(\/.*)?$/.exec(path)
    if (!match) {
      result[path] = entry
      continue
    }

    const index = Number(match[1])
    if (index === removedIndex) continue
    const suffix = match[2] ?? ''
    const newIndex = index > removedIndex ? index - 1 : index
    result[`/relationships/${newIndex}${suffix}`] = entry
  }

  return result
}

export function addRelationship(
  project: ClassGraphProject,
  input: RelationshipRecord,
  now: string,
): ClassGraphProject {
  const relationship = normalizeRelationship(input)

  if ((project.relationships ?? []).some((item) => item.id === relationship.id)) {
    throw new Error(`CG-2020 duplicate relationship id: ${relationship.id}`)
  }
  assertRelationshipEndpoints(project, relationship)
  assertNoSemanticDuplicate(project, relationship)

  const next = cloneProject(project)
  next.relationships ??= []
  next.relationships.push(relationship)
  const index = next.relationships.length - 1
  next.provenance[`/relationships/${index}`] = teacherEntered('manual-relationship-entry')
  next.updatedAt = now

  return validate(next)
}

export function updateRelationship(
  project: ClassGraphProject,
  relationshipId: string,
  patch: RelationshipPatch,
  now: string,
): ClassGraphProject {
  const index = (project.relationships ?? []).findIndex((item) => item.id === relationshipId)
  if (index < 0) throw new Error(`CG-2024 unknown relationship: ${relationshipId}`)

  const current = project.relationships?.[index]
  if (!current) throw new Error(`CG-9001 relationship index unexpectedly missing: ${relationshipId}`)

  const candidate = normalizeRelationship({
    ...current,
    ...(patch.fromStudentId !== undefined ? { fromStudentId: patch.fromStudentId } : {}),
    ...(patch.toStudentId !== undefined ? { toStudentId: patch.toStudentId } : {}),
    ...(patch.type !== undefined ? { type: patch.type } : {}),
    ...(patch.label === null
      ? { label: undefined }
      : patch.label !== undefined
        ? { label: patch.label }
        : {}),
    ...(patch.directed === null
      ? { directed: undefined }
      : patch.directed !== undefined
        ? { directed: patch.directed }
        : {}),
    ...(patch.weight === null
      ? { weight: undefined }
      : patch.weight !== undefined
        ? { weight: patch.weight }
        : {}),
  })

  assertRelationshipEndpoints(project, candidate)
  assertNoSemanticDuplicate(project, candidate, relationshipId)

  const next = cloneProject(project)
  if (!next.relationships) throw new Error('CG-9001 relationships unexpectedly missing')
  next.relationships[index] = candidate
  clearRelationshipProvenanceAtIndex(next, index)
  next.provenance[`/relationships/${index}`] = teacherEntered('manual-relationship-edit')
  next.updatedAt = now

  return validate(next)
}

export function removeRelationship(
  project: ClassGraphProject,
  relationshipId: string,
  now: string,
): ClassGraphProject {
  const index = (project.relationships ?? []).findIndex((item) => item.id === relationshipId)
  if (index < 0) throw new Error(`CG-2024 unknown relationship: ${relationshipId}`)

  const next = cloneProject(project)
  next.relationships?.splice(index, 1)
  if (next.relationships?.length === 0) delete next.relationships
  next.provenance = remapRelationshipProvenanceAfterRemoval(next.provenance, index)
  next.updatedAt = now

  return validate(next)
}
