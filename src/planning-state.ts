import type {
  ClassGraphProject,
  PlanningGroup,
  PlanningRule,
  PlanningSeatAssignment,
  ProvenanceEntry,
} from './model.js'
import { classGraphProjectSchema } from './schema.js'

function teacherEntered(source: string): ProvenanceEntry {
  return { kind: 'teacher-entered', source }
}

function cloneProject(project: ClassGraphProject): ClassGraphProject {
  return structuredClone(project)
}

function validate(project: ClassGraphProject): ClassGraphProject {
  return classGraphProjectSchema.parse(project)
}

function ensurePlanning(project: ClassGraphProject): NonNullable<ClassGraphProject['planning']> {
  project.planning ??= { ruleSchemaVersion: '1.0' }
  project.planning.ruleSchemaVersion ??= '1.0'
  return project.planning
}

function studentExists(project: ClassGraphProject, studentId: string): boolean {
  return project.students.some((student) => student.id === studentId)
}

function enabledSeatExists(project: ClassGraphProject, seatId: string): boolean {
  return project.room?.seats.some((seat) => seat.id === seatId && seat.enabled) ?? false
}

function rewriteIndexedProvenance(
  project: ClassGraphProject,
  prefix: '/planning/assignments' | '/planning/rules' | '/planning/groups',
  count: number,
  source: string,
): void {
  for (const key of Object.keys(project.provenance)) {
    if (key === prefix || key.startsWith(`${prefix}/`)) delete project.provenance[key]
  }
  project.provenance[prefix] = teacherEntered(source)
  for (let index = 0; index < count; index += 1) {
    project.provenance[`${prefix}/${index}`] = teacherEntered(source)
  }
}

export function setPlanningSeed(
  project: ClassGraphProject,
  seed: string,
  now: string,
): ClassGraphProject {
  if (!seed.trim()) throw new Error('CG-4010 planning seed must not be empty')
  const next = cloneProject(project)
  const planning = ensurePlanning(next)
  planning.seed = seed.trim()
  next.provenance['/planning/seed'] = teacherEntered('manual-planning-seed')
  next.updatedAt = now
  return validate(next)
}

export function assignStudentToSeat(
  project: ClassGraphProject,
  studentId: string,
  seatId: string,
  locked: boolean,
  now: string,
): ClassGraphProject {
  if (!studentExists(project, studentId)) throw new Error(`CG-4011 unknown student: ${studentId}`)
  if (!enabledSeatExists(project, seatId)) {
    throw new Error(`CG-4012 assignment requires an enabled seat: ${seatId}`)
  }

  const existingOccupant = project.planning?.assignments?.find(
    (assignment) => assignment.seatId === seatId && assignment.studentId !== studentId,
  )
  if (existingOccupant) {
    throw new Error(`CG-4013 seat is already occupied: ${seatId}`)
  }

  const next = cloneProject(project)
  const planning = ensurePlanning(next)
  const assignments = planning.assignments ?? []
  const currentIndex = assignments.findIndex((assignment) => assignment.studentId === studentId)
  const assignment: PlanningSeatAssignment = { studentId, seatId, locked }

  if (currentIndex >= 0) assignments[currentIndex] = assignment
  else assignments.push(assignment)

  planning.assignments = assignments
  rewriteIndexedProvenance(
    next,
    '/planning/assignments',
    assignments.length,
    'manual-seat-assignment',
  )
  next.updatedAt = now
  return validate(next)
}

export function unassignStudentFromSeat(
  project: ClassGraphProject,
  studentId: string,
  now: string,
): ClassGraphProject {
  const next = cloneProject(project)
  const planning = ensurePlanning(next)
  const assignments = (planning.assignments ?? []).filter(
    (assignment) => assignment.studentId !== studentId,
  )
  planning.assignments = assignments
  rewriteIndexedProvenance(
    next,
    '/planning/assignments',
    assignments.length,
    'manual-seat-assignment',
  )
  next.updatedAt = now
  return validate(next)
}

export function setSeatAssignmentLocked(
  project: ClassGraphProject,
  studentId: string,
  locked: boolean,
  now: string,
): ClassGraphProject {
  const next = cloneProject(project)
  const planning = ensurePlanning(next)
  const assignments = planning.assignments ?? []
  const index = assignments.findIndex((assignment) => assignment.studentId === studentId)
  if (index < 0) throw new Error(`CG-4014 student has no seat assignment: ${studentId}`)

  const current = assignments[index]
  if (!current) throw new Error(`CG-9001 assignment index unexpectedly missing: ${studentId}`)
  assignments[index] = { ...current, locked }
  planning.assignments = assignments
  rewriteIndexedProvenance(
    next,
    '/planning/assignments',
    assignments.length,
    'manual-assignment-lock',
  )
  next.updatedAt = now
  return validate(next)
}

export function replaceSeatAssignments(
  project: ClassGraphProject,
  assignments: PlanningSeatAssignment[],
  source: 'manual-seat-assignment' | 'accepted-seating-candidate',
  now: string,
): ClassGraphProject {
  const next = cloneProject(project)
  const planning = ensurePlanning(next)
  planning.assignments = structuredClone(assignments)
  rewriteIndexedProvenance(next, '/planning/assignments', assignments.length, source)
  next.updatedAt = now
  return validate(next)
}

export function addPlanningRule(
  project: ClassGraphProject,
  rule: PlanningRule,
  now: string,
): ClassGraphProject {
  const next = cloneProject(project)
  const planning = ensurePlanning(next)
  const rules = planning.rules ?? []
  if (rules.some((item) => item.id === rule.id)) {
    throw new Error(`CG-4015 duplicate planning rule id: ${rule.id}`)
  }
  rules.push(structuredClone(rule))
  planning.rules = rules
  rewriteIndexedProvenance(next, '/planning/rules', rules.length, 'manual-planning-rule')
  next.updatedAt = now
  return validate(next)
}

export function removePlanningRule(
  project: ClassGraphProject,
  ruleId: string,
  now: string,
): ClassGraphProject {
  const next = cloneProject(project)
  const planning = ensurePlanning(next)
  const rules = (planning.rules ?? []).filter((rule) => rule.id !== ruleId)
  if (rules.length === (planning.rules ?? []).length) {
    throw new Error(`CG-4016 unknown planning rule: ${ruleId}`)
  }
  planning.rules = rules
  rewriteIndexedProvenance(next, '/planning/rules', rules.length, 'manual-planning-rule')
  next.updatedAt = now
  return validate(next)
}

export function replacePlanningGroups(
  project: ClassGraphProject,
  groups: PlanningGroup[],
  source: 'manual-grouping' | 'accepted-grouping-candidate',
  now: string,
): ClassGraphProject {
  const next = cloneProject(project)
  const planning = ensurePlanning(next)
  planning.groups = structuredClone(groups)
  rewriteIndexedProvenance(next, '/planning/groups', groups.length, source)
  next.updatedAt = now
  return validate(next)
}

export function setGroupStudentLocked(
  project: ClassGraphProject,
  groupId: string,
  studentId: string,
  locked: boolean,
  now: string,
): ClassGraphProject {
  const next = cloneProject(project)
  const planning = ensurePlanning(next)
  const groups = planning.groups ?? []
  const groupIndex = groups.findIndex((group) => group.id === groupId)
  if (groupIndex < 0) throw new Error(`CG-4017 unknown group: ${groupId}`)
  const group = groups[groupIndex]
  if (!group) throw new Error(`CG-9001 group index unexpectedly missing: ${groupId}`)
  if (!group.studentIds.includes(studentId)) {
    throw new Error(`CG-4018 student is not in group ${groupId}: ${studentId}`)
  }

  const locks = new Set(group.lockedStudentIds ?? [])
  if (locked) locks.add(studentId)
  else locks.delete(studentId)
  group.lockedStudentIds = [...locks]
  rewriteIndexedProvenance(next, '/planning/groups', groups.length, 'manual-group-lock')
  next.updatedAt = now
  return validate(next)
}
