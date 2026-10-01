export type ProvenanceKind = 'observed' | 'teacher-entered' | 'imported' | 'derived' | 'synthetic'

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
  'works-well-with' | 'avoid-pairing' | 'support-pair' | 'friendship' | 'custom'

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

export type RoomFront = 'top' | 'bottom' | 'left' | 'right'

export interface RoomDefinition {
  layout: 'grid' | 'custom'
  rows?: number
  columns?: number
  front?: RoomFront
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

export interface PlanningSeatAssignment {
  studentId: string
  seatId: string
  locked: boolean
}

export interface PlanningGroup {
  id: string
  label?: string
  studentIds: string[]
  lockedStudentIds?: string[]
}

interface PlanningRuleBase {
  id: string
  label?: string
}

export type HardPlanningRule =
  | (PlanningRuleBase & {
      strength: 'hard'
      kind: 'fixed-seat'
      studentId: string
      seatId: string
    })
  | (PlanningRuleBase & {
      strength: 'hard'
      kind: 'keep-apart'
      studentAId: string
      studentBId: string
      neighbourMode?: 'orthogonal' | 'king'
    })
  | (PlanningRuleBase & {
      strength: 'hard'
      kind: 'seat-tag-required'
      studentId: string
      tag: string
    })

export type SoftPlanningRule =
  | (PlanningRuleBase & {
      strength: 'soft'
      kind: 'prefer-together'
      studentAId: string
      studentBId: string
      weight?: number
    })
  | (PlanningRuleBase & {
      strength: 'soft'
      kind: 'prefer-apart'
      studentAId: string
      studentBId: string
      weight?: number
    })
  | (PlanningRuleBase & {
      strength: 'soft'
      kind: 'prefer-seat-tag'
      studentId: string
      tag: string
      weight?: number
    })
  | (PlanningRuleBase & {
      strength: 'soft'
      kind: 'balance-metric-by-row'
      metricKey: string
      weight?: number
    })

export type PlanningRule = HardPlanningRule | SoftPlanningRule

export interface ApprovedSeatingHistoryEntry {
  version: '1.0'
  id: string
  label?: string
  approvedAt: string
  neighbourMode: 'orthogonal' | 'king'
  room: RoomDefinition
  assignments: PlanningSeatAssignment[]
}

export interface PlanningScenario {
  version: '1.0'
  id: string
  label: string
  savedAt: string
  room?: RoomDefinition
  seed?: string
  selectedMetricKeys?: string[]
  assignments: PlanningSeatAssignment[]
  rules: PlanningRule[]
  groups: PlanningGroup[]
  approvedCandidateId?: string
}

export interface PlanningConfiguration {
  ruleSchemaVersion?: '1.0'
  seed?: string
  selectedMetricKeys?: string[]
  assignments?: PlanningSeatAssignment[]
  rules?: PlanningRule[]
  groups?: PlanningGroup[]
  approvedCandidateId?: string
  history?: ApprovedSeatingHistoryEntry[]
  scenarios?: PlanningScenario[]
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
