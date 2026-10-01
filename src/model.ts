export type ProvenanceKind =
  | 'observed'
  | 'teacher-entered'
  | 'imported'
  | 'derived'
  | 'synthetic'

export interface ProvenanceEntry {
  kind: ProvenanceKind
  source?: string
  note?: string
  derivedFrom?: string[]
}

export type FieldProvenanceMap = Record<string, ProvenanceEntry>

export type MetricKind = 'number' | 'ordinal' | 'category' | 'boolean' | 'text'
export type MetricValue = number | string | boolean | null

export interface MetricDefinition {
  key: string
  label: string
  kind: MetricKind
  description?: string
  numberScale?: {
    min?: number
    max?: number
    unit?: string
  }
  ordinalScale?: string[]
  categories?: string[]
  missingAllowed?: boolean
}

export interface StudentRecord {
  id: string
  displayName?: string
  tags?: string[]
  metrics: Record<string, MetricValue>
  notes?: string
}

export type RelationshipType =
  | 'works-well-with'
  | 'avoid-pairing'
  | 'support-pair'
  | 'friendship'
  | 'custom'

export interface RelationshipRecord {
  id: string
  fromStudentId: string
  toStudentId: string
  type: RelationshipType
  label?: string
  directed?: boolean
  weight?: number
}

export interface SeatDefinition {
  id: string
  row?: number
  column?: number
  x?: number
  y?: number
  enabled: boolean
  tags?: string[]
}

export interface RoomDefinition {
  layout: 'grid' | 'custom'
  rows?: number
  columns?: number
  seats: SeatDefinition[]
}

export interface ClassInfo {
  classId?: string
  subject?: string
  gradeOrLevel?: string
  term?: string
  teacherLabel?: string
  notes?: string
}

export interface PlanningConfiguration {
  seed?: string
  selectedMetricKeys?: string[]
  rules?: unknown[]
}

export interface ClassGraphProject {
  schemaVersion: '1.0'
  projectId: string
  title: string
  createdAt: string
  updatedAt: string
  classInfo: ClassInfo
  metricDefinitions: MetricDefinition[]
  students: StudentRecord[]
  relationships?: RelationshipRecord[]
  room?: RoomDefinition
  planning?: PlanningConfiguration
  provenance: FieldProvenanceMap
  extensions?: Record<string, unknown>
}
