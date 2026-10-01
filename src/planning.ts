import type {
  ClassGraphProject,
  HardPlanningRule,
  PlanningRule,
  PlanningSeatAssignment,
  SeatDefinition,
  SoftPlanningRule,
} from './model.js'
import { deterministicUnit } from './random.js'

export interface HardConstraintResult {
  ruleId: string
  kind: HardPlanningRule['kind'] | 'capacity' | 'locked-assignment'
  satisfied: boolean
  message: string
}

export interface ObjectiveResult {
  ruleId: string
  kind: SoftPlanningRule['kind']
  penalty: number
  weight: number
  details: string
}

export interface SeatingCandidate {
  id: string
  seed: string
  assignments: PlanningSeatAssignment[]
  feasible: boolean
  hardConstraintResults: HardConstraintResult[]
  objectiveResults: ObjectiveResult[]
  totalPenalty: number
  explanation: string[]
}

export interface SeatingGenerationResult {
  seed: string
  candidates: SeatingCandidate[]
  infeasibleReasons: string[]
  attempts: number
}

export interface SeatingGenerationOptions {
  seed?: string
  candidateCount?: number
  attempts?: number
}

type AssignmentMap = Map<string, string>

function enabledSeats(project: ClassGraphProject): SeatDefinition[] {
  return (project.room?.seats ?? []).filter((seat) => seat.enabled)
}

function seatById(project: ClassGraphProject): Map<string, SeatDefinition> {
  return new Map((project.room?.seats ?? []).map((seat) => [seat.id, seat]))
}

function studentById(project: ClassGraphProject) {
  return new Map(project.students.map((student) => [student.id, student]))
}

function ruleWeight(rule: SoftPlanningRule): number {
  return rule.weight ?? 1
}

function seatDistance(a: SeatDefinition, b: SeatDefinition): number {
  if (
    a.row !== undefined &&
    a.column !== undefined &&
    b.row !== undefined &&
    b.column !== undefined
  ) {
    return Math.abs(a.row - b.row) + Math.abs(a.column - b.column)
  }
  if (a.x !== undefined && a.y !== undefined && b.x !== undefined && b.y !== undefined) {
    return Math.hypot(a.x - b.x, a.y - b.y)
  }
  return Number.POSITIVE_INFINITY
}

function seatsAreNeighbours(
  a: SeatDefinition,
  b: SeatDefinition,
  mode: 'orthogonal' | 'king',
): boolean {
  if (
    a.row !== undefined &&
    a.column !== undefined &&
    b.row !== undefined &&
    b.column !== undefined
  ) {
    const rowDelta = Math.abs(a.row - b.row)
    const columnDelta = Math.abs(a.column - b.column)
    if (mode === 'king') return Math.max(rowDelta, columnDelta) === 1
    return rowDelta + columnDelta === 1
  }

  return seatDistance(a, b) <= 1
}

function assignmentSignature(assignments: PlanningSeatAssignment[]): string {
  return assignments
    .map((assignment) => `${assignment.studentId}=${assignment.seatId}`)
    .sort()
    .join('|')
}

function deterministicOrder<T>(
  values: T[],
  seed: string,
  key: string,
  identity: (value: T) => string,
): T[] {
  return [...values].sort((left, right) => {
    const leftKey = identity(left)
    const rightKey = identity(right)
    const difference =
      deterministicUnit(seed, `${key}:${leftKey}`) - deterministicUnit(seed, `${key}:${rightKey}`)
    return difference || leftKey.localeCompare(rightKey)
  })
}

function applyRequiredAssignments(project: ClassGraphProject): {
  assignments: AssignmentMap
  lockedStudents: Set<string>
  reasons: string[]
} {
  const assignments: AssignmentMap = new Map()
  const seatOccupants = new Map<string, string>()
  const lockedStudents = new Set<string>()
  const reasons: string[] = []

  const add = (studentId: string, seatId: string, source: string, locked: boolean): void => {
    const existingSeat = assignments.get(studentId)
    if (existingSeat && existingSeat !== seatId) {
      reasons.push(`${source} conflicts for ${studentId}: ${existingSeat} vs ${seatId}`)
      return
    }
    const existingStudent = seatOccupants.get(seatId)
    if (existingStudent && existingStudent !== studentId) {
      reasons.push(`${source} conflicts at ${seatId}: ${existingStudent} and ${studentId}`)
      return
    }
    assignments.set(studentId, seatId)
    seatOccupants.set(seatId, studentId)
    if (locked) lockedStudents.add(studentId)
  }

  for (const assignment of project.planning?.assignments ?? []) {
    if (assignment.locked) {
      add(assignment.studentId, assignment.seatId, 'Locked assignment', true)
    }
  }

  for (const rule of project.planning?.rules ?? []) {
    if (rule.strength === 'hard' && rule.kind === 'fixed-seat') {
      add(rule.studentId, rule.seatId, `Fixed-seat rule ${rule.id}`, false)
    }
  }

  return { assignments, lockedStudents, reasons }
}

function preflightReasons(project: ClassGraphProject): string[] {
  const reasons: string[] = []
  const seats = enabledSeats(project)
  if (!project.room) return ['Create a room before generating seating candidates.']
  if (seats.length < project.students.length) {
    reasons.push(
      `Enabled capacity is ${seats.length} seats for ${project.students.length} students.`,
    )
  }

  const seatMap = seatById(project)
  const studentIds = new Set(project.students.map((student) => student.id))
  const required = applyRequiredAssignments(project)
  reasons.push(...required.reasons)

  for (const [studentId, seatId] of required.assignments) {
    if (!studentIds.has(studentId))
      reasons.push(`Required assignment references unknown student ${studentId}.`)
    if (!seatMap.get(seatId)?.enabled) reasons.push(`Required seat ${seatId} is not enabled.`)
  }

  for (const rule of project.planning?.rules ?? []) {
    if (rule.strength !== 'hard') continue
    if (rule.kind === 'seat-tag-required') {
      const eligible = seats.some((seat) => seat.tags?.includes(rule.tag))
      if (!eligible) {
        reasons.push(
          `Rule ${rule.id} requires seat tag "${rule.tag}", but no enabled seat has that tag.`,
        )
      }
    }
  }

  return [...new Set(reasons)]
}

function evaluateHardConstraints(
  project: ClassGraphProject,
  assignments: AssignmentMap,
): HardConstraintResult[] {
  const results: HardConstraintResult[] = []
  const seats = seatById(project)

  for (const rule of project.planning?.rules ?? []) {
    if (rule.strength !== 'hard') continue

    if (rule.kind === 'fixed-seat') {
      const satisfied = assignments.get(rule.studentId) === rule.seatId
      results.push({
        ruleId: rule.id,
        kind: rule.kind,
        satisfied,
        message: satisfied
          ? `${rule.studentId} is fixed to ${rule.seatId}.`
          : `${rule.studentId} must be fixed to ${rule.seatId}.`,
      })
      continue
    }

    if (rule.kind === 'seat-tag-required') {
      const seat = seats.get(assignments.get(rule.studentId) ?? '')
      const satisfied = seat?.tags?.includes(rule.tag) ?? false
      results.push({
        ruleId: rule.id,
        kind: rule.kind,
        satisfied,
        message: satisfied
          ? `${rule.studentId} is in a seat tagged ${rule.tag}.`
          : `${rule.studentId} requires a seat tagged ${rule.tag}.`,
      })
      continue
    }

    const seatA = seats.get(assignments.get(rule.studentAId) ?? '')
    const seatB = seats.get(assignments.get(rule.studentBId) ?? '')
    const mode = rule.neighbourMode ?? 'orthogonal'
    const satisfied = Boolean(seatA && seatB && !seatsAreNeighbours(seatA, seatB, mode))
    results.push({
      ruleId: rule.id,
      kind: rule.kind,
      satisfied,
      message: satisfied
        ? `${rule.studentAId} and ${rule.studentBId} are not ${mode} neighbours.`
        : `${rule.studentAId} and ${rule.studentBId} must not be ${mode} neighbours.`,
    })
  }

  return results
}

function metricNumericValue(
  project: ClassGraphProject,
  studentId: string,
  metricKey: string,
): number | undefined {
  const definition = project.metricDefinitions.find((item) => item.key === metricKey)
  const student = studentById(project).get(studentId)
  const value = student?.metrics[metricKey]

  if (definition?.kind === 'number' && typeof value === 'number') return value
  if (definition?.kind === 'ordinal' && typeof value === 'string') {
    const index = definition.ordinalScale?.indexOf(value) ?? -1
    return index >= 0 ? index + 1 : undefined
  }
  return undefined
}

function evaluateSoftObjectives(
  project: ClassGraphProject,
  assignments: AssignmentMap,
): ObjectiveResult[] {
  const results: ObjectiveResult[] = []
  const seats = seatById(project)

  for (const rule of project.planning?.rules ?? []) {
    if (rule.strength !== 'soft') continue
    const weight = ruleWeight(rule)

    if (rule.kind === 'prefer-together' || rule.kind === 'prefer-apart') {
      const seatA = seats.get(assignments.get(rule.studentAId) ?? '')
      const seatB = seats.get(assignments.get(rule.studentBId) ?? '')
      const distance = seatA && seatB ? seatDistance(seatA, seatB) : Number.POSITIVE_INFINITY
      const rawPenalty =
        rule.kind === 'prefer-together'
          ? Number.isFinite(distance)
            ? distance
            : 1000
          : Number.isFinite(distance)
            ? 1 / (1 + distance)
            : 0
      results.push({
        ruleId: rule.id,
        kind: rule.kind,
        penalty: rawPenalty * weight,
        weight,
        details: Number.isFinite(distance)
          ? `Seat distance is ${distance.toFixed(2)}.`
          : 'One or both students are not assigned.',
      })
      continue
    }

    if (rule.kind === 'prefer-seat-tag') {
      const seat = seats.get(assignments.get(rule.studentId) ?? '')
      const matched = seat?.tags?.includes(rule.tag) ?? false
      results.push({
        ruleId: rule.id,
        kind: rule.kind,
        penalty: matched ? 0 : weight,
        weight,
        details: matched
          ? `${rule.studentId} is in a seat tagged ${rule.tag}.`
          : `${rule.studentId} is not in a seat tagged ${rule.tag}.`,
      })
      continue
    }

    const rows = new Map<number, number[]>()
    let missing = 0
    for (const [studentId, seatId] of assignments) {
      const seat = seats.get(seatId)
      if (seat?.row === undefined) continue
      const value = metricNumericValue(project, studentId, rule.metricKey)
      if (value === undefined) {
        missing += 1
        continue
      }
      const values = rows.get(seat.row) ?? []
      values.push(value)
      rows.set(seat.row, values)
    }

    const means = [...rows.values()]
      .filter((values) => values.length > 0)
      .map((values) => values.reduce((sum, value) => sum + value, 0) / values.length)
    const spread = means.length > 1 ? Math.max(...means) - Math.min(...means) : 0
    results.push({
      ruleId: rule.id,
      kind: rule.kind,
      penalty: spread * weight,
      weight,
      details: `Row mean spread is ${spread.toFixed(2)}; ${missing} assignment(s) lacked a recorded value and were ignored.`,
    })
  }

  return results
}

function candidateExplanation(
  hardResults: HardConstraintResult[],
  objectives: ObjectiveResult[],
): string[] {
  const explanation: string[] = []
  if (hardResults.every((result) => result.satisfied)) {
    explanation.push('All hard constraints are satisfied.')
  }
  if (objectives.length === 0) {
    explanation.push(
      'No soft objectives are selected; candidates differ only by seeded arrangement.',
    )
    return explanation
  }

  const ordered = [...objectives].sort((a, b) => b.penalty - a.penalty)
  explanation.push(
    ...ordered
      .slice(0, 3)
      .map(
        (result) =>
          `${result.kind} (${result.ruleId}) penalty ${result.penalty.toFixed(2)}: ${result.details}`,
      ),
  )
  return explanation
}

function createCandidate(
  project: ClassGraphProject,
  seed: string,
  attempt: number,
): SeatingCandidate | null {
  const seats = enabledSeats(project)
  const required = applyRequiredAssignments(project)
  if (required.reasons.length > 0) return null

  const usedSeats = new Set(required.assignments.values())
  const remainingStudents = project.students.filter(
    (student) => !required.assignments.has(student.id),
  )
  const remainingSeats = seats.filter((seat) => !usedSeats.has(seat.id))
  if (remainingSeats.length < remainingStudents.length) return null

  const students = deterministicOrder(
    remainingStudents,
    seed,
    `attempt:${attempt}:students`,
    (student) => student.id,
  )
  const available = deterministicOrder(
    remainingSeats,
    seed,
    `attempt:${attempt}:seats`,
    (seat) => seat.id,
  )

  const map: AssignmentMap = new Map(required.assignments)
  for (let index = 0; index < students.length; index += 1) {
    const student = students[index]
    const seat = available[index]
    if (student && seat) map.set(student.id, seat.id)
  }

  const hardConstraintResults = evaluateHardConstraints(project, map)
  const feasible = hardConstraintResults.every((result) => result.satisfied)
  if (!feasible) return null

  const objectiveResults = evaluateSoftObjectives(project, map)
  const totalPenalty = objectiveResults.reduce((sum, result) => sum + result.penalty, 0)
  const assignments = project.students
    .map((student) => {
      const seatId = map.get(student.id)
      if (!seatId) return null
      return {
        studentId: student.id,
        seatId,
        locked: required.lockedStudents.has(student.id),
      }
    })
    .filter((assignment): assignment is PlanningSeatAssignment => assignment !== null)

  return {
    id: `seat-candidate-${attempt + 1}`,
    seed,
    assignments,
    feasible,
    hardConstraintResults,
    objectiveResults,
    totalPenalty,
    explanation: candidateExplanation(hardConstraintResults, objectiveResults),
  }
}

export function generateSeatingCandidates(
  project: ClassGraphProject,
  options: SeatingGenerationOptions = {},
): SeatingGenerationResult {
  const seed = options.seed?.trim() || project.planning?.seed?.trim() || 'classgraph-seating'
  const candidateCount = Math.max(1, Math.min(10, options.candidateCount ?? 3))
  const attempts = Math.max(candidateCount, Math.min(3000, options.attempts ?? 500))
  const reasons = preflightReasons(project)

  if (reasons.length > 0) {
    return { seed, candidates: [], infeasibleReasons: reasons, attempts: 0 }
  }

  const distinct = new Map<string, SeatingCandidate>()
  const failureCounts = new Map<string, number>()

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const candidate = createCandidate(project, seed, attempt)
    if (candidate) {
      const signature = assignmentSignature(candidate.assignments)
      const previous = distinct.get(signature)
      if (!previous || candidate.totalPenalty < previous.totalPenalty)
        distinct.set(signature, candidate)
      continue
    }

    const seats = enabledSeats(project)
    const required = applyRequiredAssignments(project)
    if (required.reasons.length > 0 || seats.length < project.students.length) continue

    const usedSeats = new Set(required.assignments.values())
    const students = deterministicOrder(
      project.students.filter((student) => !required.assignments.has(student.id)),
      seed,
      `failure:${attempt}:students`,
      (student) => student.id,
    )
    const available = deterministicOrder(
      seats.filter((seat) => !usedSeats.has(seat.id)),
      seed,
      `failure:${attempt}:seats`,
      (seat) => seat.id,
    )
    const map: AssignmentMap = new Map(required.assignments)
    for (let index = 0; index < students.length; index += 1) {
      const student = students[index]
      const seat = available[index]
      if (student && seat) map.set(student.id, seat.id)
    }
    for (const result of evaluateHardConstraints(project, map)) {
      if (!result.satisfied)
        failureCounts.set(result.ruleId, (failureCounts.get(result.ruleId) ?? 0) + 1)
    }
  }

  const candidates = [...distinct.values()]
    .sort(
      (left, right) =>
        left.totalPenalty - right.totalPenalty ||
        assignmentSignature(left.assignments).localeCompare(assignmentSignature(right.assignments)),
    )
    .slice(0, candidateCount)
    .map((candidate, index) => ({ ...candidate, id: `seat-candidate-${index + 1}` }))

  const infeasibleReasons =
    candidates.length > 0
      ? []
      : [
          `No arrangement satisfied every hard constraint in ${attempts} deterministic attempts.`,
          ...[...failureCounts.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(
              ([ruleId, count]) =>
                `Hard rule ${ruleId} was violated in ${count} of ${attempts} tested arrangements.`,
            ),
        ]

  return { seed, candidates, infeasibleReasons, attempts }
}
