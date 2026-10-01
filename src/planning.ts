import type { ClassGraphProject, RelationshipRecord, RoomDefinition } from './model.js'
import { deterministicInt, deterministicUnit } from './random.js'

export interface SeatingPlanConfig {
  rows: number
  columns: number
  seed: string
  balanceMetricKey?: string
  candidateCount?: number
  iterations?: number
}

export interface SeatingAssignment {
  seatId: string
  studentId: string | null
}

export interface SeatingCandidateMetrics {
  hardAvoidViolations: number
  supportAdjacencyMisses: number
  rowBalancePenalty: number
}

export interface SeatingCandidate {
  id: string
  seed: string
  room: RoomDefinition
  assignments: SeatingAssignment[]
  metrics: SeatingCandidateMetrics
}

interface PositionedSeat {
  id: string
  row: number
  column: number
}

interface CandidateState {
  occupants: Array<string | null>
  metrics: SeatingCandidateMetrics
}

export function createGridRoom(rows: number, columns: number): RoomDefinition {
  if (!Number.isInteger(rows) || !Number.isInteger(columns) || rows < 1 || columns < 1) {
    throw new Error('CG-4001 room rows and columns must be positive integers')
  }
  if (rows * columns > 500) {
    throw new Error('CG-4002 room cannot contain more than 500 seats')
  }

  return {
    layout: 'grid',
    rows,
    columns,
    seats: Array.from({ length: rows * columns }, (_, index) => {
      const row = Math.floor(index / columns)
      const column = index % columns
      return {
        id: `r${row + 1}-c${column + 1}`,
        row,
        column,
        enabled: true,
        tags: row === 0 ? ['front'] : undefined,
      }
    }),
  }
}

function positionedSeats(room: RoomDefinition): PositionedSeat[] {
  const seats = room.seats
    .filter((seat) => seat.enabled)
    .map((seat) => {
      if (seat.row === undefined || seat.column === undefined) {
        throw new Error('CG-4003 seating optimisation requires grid row/column coordinates')
      }
      return { id: seat.id, row: seat.row, column: seat.column }
    })

  if (seats.length === 0) throw new Error('CG-4004 room has no enabled seats')
  return seats
}

function adjacencyPairs(seats: PositionedSeat[]): Array<[number, number]> {
  const pairs: Array<[number, number]> = []
  for (let left = 0; left < seats.length; left += 1) {
    const a = seats[left]
    if (!a) continue
    for (let right = left + 1; right < seats.length; right += 1) {
      const b = seats[right]
      if (!b) continue
      const distance = Math.abs(a.row - b.row) + Math.abs(a.column - b.column)
      if (distance === 1) pairs.push([left, right])
    }
  }
  return pairs
}

function relationshipKey(a: string, b: string): string {
  return a < b ? `${a}::${b}` : `${b}::${a}`
}

function relationshipSets(relationships: RelationshipRecord[] | undefined): {
  avoid: Set<string>
  support: Set<string>
} {
  const avoid = new Set<string>()
  const support = new Set<string>()

  for (const relationship of relationships ?? []) {
    const key = relationshipKey(relationship.fromStudentId, relationship.toStudentId)
    if (relationship.type === 'avoid-pairing') avoid.add(key)
    if (relationship.type === 'support-pair' || relationship.type === 'works-well-with') {
      support.add(key)
    }
  }

  return { avoid, support }
}

function numericValues(project: ClassGraphProject, metricKey: string | undefined): Map<string, number> {
  const values = new Map<string, number>()
  if (!metricKey) return values

  const definition = project.metricDefinitions.find((item) => item.key === metricKey)
  if (!definition || definition.kind !== 'number') {
    throw new Error('CG-4005 balance metric must be a numeric metric')
  }

  for (const student of project.students) {
    const value = student.metrics[metricKey]
    if (typeof value === 'number') values.set(student.id, value)
  }
  return values
}

function scoreState(
  occupants: Array<string | null>,
  seats: PositionedSeat[],
  adjacent: Array<[number, number]>,
  avoid: Set<string>,
  support: Set<string>,
  metricValues: Map<string, number>,
): SeatingCandidateMetrics {
  let hardAvoidViolations = 0
  const adjacentStudentPairs = new Set<string>()

  for (const [left, right] of adjacent) {
    const a = occupants[left]
    const b = occupants[right]
    if (!a || !b) continue
    const key = relationshipKey(a, b)
    adjacentStudentPairs.add(key)
    if (avoid.has(key)) hardAvoidViolations += 1
  }

  let supportAdjacencyMisses = 0
  for (const key of support) {
    if (!adjacentStudentPairs.has(key)) supportAdjacencyMisses += 1
  }

  let rowBalancePenalty = 0
  if (metricValues.size > 0) {
    const allValues = [...metricValues.values()]
    const classMean = allValues.reduce((sum, value) => sum + value, 0) / allValues.length
    const min = Math.min(...allValues)
    const max = Math.max(...allValues)
    const range = Math.max(max - min, 1)

    const rows = new Map<number, number[]>()
    for (let index = 0; index < occupants.length; index += 1) {
      const studentId = occupants[index]
      const seat = seats[index]
      if (!studentId || !seat) continue
      const value = metricValues.get(studentId)
      if (value === undefined) continue
      const bucket = rows.get(seat.row) ?? []
      bucket.push(value)
      rows.set(seat.row, bucket)
    }

    if (rows.size > 0) {
      const deviations = [...rows.values()].map((values) => {
        const mean = values.reduce((sum, value) => sum + value, 0) / values.length
        return Math.abs(mean - classMean) / range
      })
      rowBalancePenalty =
        deviations.reduce((sum, deviation) => sum + deviation, 0) / deviations.length
    }
  }

  return {
    hardAvoidViolations,
    supportAdjacencyMisses,
    rowBalancePenalty,
  }
}

function isBetter(next: SeatingCandidateMetrics, current: SeatingCandidateMetrics): boolean {
  if (next.hardAvoidViolations !== current.hardAvoidViolations) {
    return next.hardAvoidViolations < current.hardAvoidViolations
  }
  if (next.supportAdjacencyMisses !== current.supportAdjacencyMisses) {
    return next.supportAdjacencyMisses < current.supportAdjacencyMisses
  }
  return next.rowBalancePenalty + 1e-12 < current.rowBalancePenalty
}

function initialOccupants(studentIds: string[], seatCount: number, seed: string): Array<string | null> {
  const tokens: Array<string | null> = [
    ...studentIds,
    ...Array.from({ length: seatCount - studentIds.length }, () => null),
  ]

  return tokens
    .map((studentId, index) => ({
      studentId,
      order: deterministicUnit(seed, `initial:${index}:${studentId ?? 'empty'}`),
    }))
    .sort((a, b) => a.order - b.order)
    .map((item) => item.studentId)
}

function optimiseCandidate(
  project: ClassGraphProject,
  room: RoomDefinition,
  candidateSeed: string,
  balanceMetricKey: string | undefined,
  iterations: number,
): CandidateState {
  const seats = positionedSeats(room)
  if (project.students.length > seats.length) {
    throw new Error(
      `CG-4006 room has ${seats.length} enabled seats for ${project.students.length} students`,
    )
  }

  const adjacent = adjacencyPairs(seats)
  const { avoid, support } = relationshipSets(project.relationships)
  const metricValues = numericValues(project, balanceMetricKey)
  let occupants = initialOccupants(
    project.students.map((student) => student.id),
    seats.length,
    candidateSeed,
  )
  let metrics = scoreState(occupants, seats, adjacent, avoid, support, metricValues)

  if (occupants.length < 2) return { occupants, metrics }

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const left = deterministicInt(candidateSeed, `swap:${iteration}:left`, 0, occupants.length - 1)
    let right = deterministicInt(candidateSeed, `swap:${iteration}:right`, 0, occupants.length - 2)
    if (right >= left) right += 1
    if (left === right) continue

    const nextOccupants = [...occupants]
    const temporary = nextOccupants[left]
    nextOccupants[left] = nextOccupants[right] ?? null
    nextOccupants[right] = temporary ?? null

    const nextMetrics = scoreState(nextOccupants, seats, adjacent, avoid, support, metricValues)
    if (isBetter(nextMetrics, metrics)) {
      occupants = nextOccupants
      metrics = nextMetrics
    }
  }

  return { occupants, metrics }
}

export function planSeating(
  project: ClassGraphProject,
  config: SeatingPlanConfig,
): SeatingCandidate[] {
  const room = createGridRoom(config.rows, config.columns)
  const seats = positionedSeats(room)
  if (project.students.length > seats.length) {
    throw new Error(
      `CG-4006 room has ${seats.length} enabled seats for ${project.students.length} students`,
    )
  }

  const candidateCount = Math.min(6, Math.max(1, config.candidateCount ?? 3))
  const iterations = Math.min(20_000, Math.max(100, config.iterations ?? 2_000))

  return Array.from({ length: candidateCount }, (_, index) => {
    const candidateSeed = `${config.seed}:candidate-${index + 1}`
    const state = optimiseCandidate(
      project,
      room,
      candidateSeed,
      config.balanceMetricKey,
      iterations,
    )
    return {
      id: `candidate-${index + 1}`,
      seed: candidateSeed,
      room,
      assignments: seats.map((seat, seatIndex) => ({
        seatId: seat.id,
        studentId: state.occupants[seatIndex] ?? null,
      })),
      metrics: state.metrics,
    }
  }).sort((a, b) => {
    if (a.metrics.hardAvoidViolations !== b.metrics.hardAvoidViolations) {
      return a.metrics.hardAvoidViolations - b.metrics.hardAvoidViolations
    }
    if (a.metrics.supportAdjacencyMisses !== b.metrics.supportAdjacencyMisses) {
      return a.metrics.supportAdjacencyMisses - b.metrics.supportAdjacencyMisses
    }
    return a.metrics.rowBalancePenalty - b.metrics.rowBalancePenalty
  })
}
