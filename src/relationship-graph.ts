import type {
  ClassGraphProject,
  ProvenanceEntry,
  RelationshipType,
} from './model.js'
import { buildRelationshipTable } from './relationship-table.js'

export interface RelationshipGraphNode {
  studentId: string
  label: string
  x: number
  y: number
  focused: boolean
  connectedToFocus: boolean
}

export interface RelationshipGraphEdge {
  relationshipId: string
  fromStudentId: string
  toStudentId: string
  type: RelationshipType
  label?: string
  directed: boolean
  weight?: number
  provenance?: ProvenanceEntry
}

export interface RelationshipGraph {
  focusStudentId?: string
  nodes: RelationshipGraphNode[]
  edges: RelationshipGraphEdge[]
}

function rounded(value: number): number {
  return Number(value.toFixed(6))
}

function ringPosition(index: number, count: number, radius: number): { x: number; y: number } {
  if (count <= 1) return { x: 0.5, y: 0.5 }
  const angle = -Math.PI / 2 + (index * 2 * Math.PI) / count
  return {
    x: rounded(0.5 + radius * Math.cos(angle)),
    y: rounded(0.5 + radius * Math.sin(angle)),
  }
}

export function buildRelationshipGraph(
  project: ClassGraphProject,
  focusStudentId?: string,
): RelationshipGraph {
  const sortedStudents = [...project.students].sort((left, right) => left.id.localeCompare(right.id))
  const validFocus = sortedStudents.some((student) => student.id === focusStudentId)
    ? focusStudentId
    : undefined

  const tableRows = buildRelationshipTable(project)
  const edges: RelationshipGraphEdge[] = tableRows.map((row) => ({
    relationshipId: row.id,
    fromStudentId: row.fromStudentId,
    toStudentId: row.toStudentId,
    type: row.type,
    ...(row.label ? { label: row.label } : {}),
    directed: row.directed,
    ...(row.weight !== undefined ? { weight: row.weight } : {}),
    ...(row.provenance ? { provenance: row.provenance } : {}),
  }))

  if (!validFocus) {
    return {
      nodes: sortedStudents.map((student, index) => ({
        studentId: student.id,
        label: student.displayName ?? student.id,
        ...ringPosition(index, sortedStudents.length, 0.4),
        focused: false,
        connectedToFocus: false,
      })),
      edges,
    }
  }

  const neighbours = new Set<string>()
  for (const edge of edges) {
    if (edge.fromStudentId === validFocus) neighbours.add(edge.toStudentId)
    if (edge.toStudentId === validFocus) neighbours.add(edge.fromStudentId)
  }

  const connected = sortedStudents.filter(
    (student) => student.id !== validFocus && neighbours.has(student.id),
  )
  const remainder = sortedStudents.filter(
    (student) => student.id !== validFocus && !neighbours.has(student.id),
  )

  const nodes: RelationshipGraphNode[] = [
    {
      studentId: validFocus,
      label:
        sortedStudents.find((student) => student.id === validFocus)?.displayName ?? validFocus,
      x: 0.5,
      y: 0.5,
      focused: true,
      connectedToFocus: false,
    },
    ...connected.map((student, index) => ({
      studentId: student.id,
      label: student.displayName ?? student.id,
      ...ringPosition(index, connected.length, 0.26),
      focused: false,
      connectedToFocus: true,
    })),
    ...remainder.map((student, index) => ({
      studentId: student.id,
      label: student.displayName ?? student.id,
      ...ringPosition(index, remainder.length, 0.43),
      focused: false,
      connectedToFocus: false,
    })),
  ]

  return {
    focusStudentId: validFocus,
    nodes,
    edges,
  }
}
