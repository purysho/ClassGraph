import type {
  ClassGraphProject,
  PlanningScenario,
  ProvenanceEntry,
} from './model.js'
import { compareGroupNetworks, type GroupNetworkComparison } from './network-comparison.js'
import { classGraphProjectSchema } from './schema.js'
import { deterministicId } from './stable-id.js'

export interface PlanningScenarioComparison {
  leftScenarioId: string
  rightScenarioId: string
  assignments: {
    leftCount: number
    rightCount: number
    unchangedStudents: string[]
    movedStudents: string[]
    addedStudents: string[]
    removedStudents: string[]
  }
  groups: {
    leftCount: number
    rightCount: number
    unchangedStudents: string[]
    changedStudents: string[]
    addedStudents: string[]
    removedStudents: string[]
  }
  rules: {
    leftCount: number
    rightCount: number
    addedRuleIds: string[]
    removedRuleIds: string[]
  }
  network: GroupNetworkComparison
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

function ensurePlanning(project: ClassGraphProject): NonNullable<ClassGraphProject['planning']> {
  project.planning ??= { ruleSchemaVersion: '1.0' }
  project.planning.ruleSchemaVersion ??= '1.0'
  return project.planning
}

function remapScenarioProvenance(
  provenance: ClassGraphProject['provenance'],
  removedIndex: number,
): ClassGraphProject['provenance'] {
  const result: ClassGraphProject['provenance'] = {}

  for (const [path, entry] of Object.entries(provenance)) {
    const match = /^\/planning\/scenarios\/(\d+)(\/.*)?$/.exec(path)
    if (!match) {
      result[path] = entry
      continue
    }

    const index = Number(match[1])
    if (index === removedIndex) continue
    const suffix = match[2] ?? ''
    const nextIndex = index > removedIndex ? index - 1 : index
    result[`/planning/scenarios/${nextIndex}${suffix}`] = entry
  }

  return result
}

export function buildPlanningScenario(
  project: ClassGraphProject,
  label: string,
  now: string,
): PlanningScenario {
  const trimmedLabel = label.trim()
  if (!trimmedLabel) throw new Error('CG-4030 scenario label must not be empty')

  const planning = project.planning
  const snapshot = {
    version: '1.0' as const,
    label: trimmedLabel,
    ...(project.room ? { room: structuredClone(project.room) } : {}),
    ...(planning?.seed ? { seed: planning.seed } : {}),
    ...(planning?.selectedMetricKeys
      ? { selectedMetricKeys: structuredClone(planning.selectedMetricKeys) }
      : {}),
    assignments: structuredClone(planning?.assignments ?? []),
    rules: structuredClone(planning?.rules ?? []),
    groups: structuredClone(planning?.groups ?? []),
    ...(planning?.approvedCandidateId
      ? { approvedCandidateId: planning.approvedCandidateId }
      : {}),
  }

  return {
    id: deterministicId('scenario', snapshot),
    savedAt: now,
    ...snapshot,
  }
}

export function savePlanningScenario(
  project: ClassGraphProject,
  label: string,
  now: string,
): ClassGraphProject {
  const scenario = buildPlanningScenario(project, label, now)
  const next = cloneProject(project)
  const planning = ensurePlanning(next)
  planning.scenarios ??= []

  if (planning.scenarios.some((item) => item.id === scenario.id)) {
    throw new Error(`CG-4031 identical planning scenario already saved: ${scenario.id}`)
  }

  planning.scenarios.push(scenario)
  next.provenance[`/planning/scenarios/${planning.scenarios.length - 1}`] = teacherEntered(
    'saved-planning-scenario',
  )
  next.updatedAt = now
  return validate(next)
}

export function removePlanningScenario(
  project: ClassGraphProject,
  scenarioId: string,
  now: string,
): ClassGraphProject {
  const index = (project.planning?.scenarios ?? []).findIndex((item) => item.id === scenarioId)
  if (index < 0) throw new Error(`CG-4032 unknown planning scenario: ${scenarioId}`)

  const next = cloneProject(project)
  const planning = ensurePlanning(next)
  planning.scenarios?.splice(index, 1)
  next.provenance = remapScenarioProvenance(next.provenance, index)
  next.updatedAt = now
  return validate(next)
}

function assignmentMap(scenario: PlanningScenario): Map<string, string> {
  return new Map(scenario.assignments.map((assignment) => [assignment.studentId, assignment.seatId]))
}

function groupMembership(scenario: PlanningScenario): Map<string, string> {
  const result = new Map<string, string>()
  for (const group of scenario.groups) {
    for (const studentId of group.studentIds) result.set(studentId, group.id)
  }
  return result
}

function compareMembership(
  left: Map<string, string>,
  right: Map<string, string>,
): {
  unchangedStudents: string[]
  changedStudents: string[]
  addedStudents: string[]
  removedStudents: string[]
} {
  const ids = [...new Set([...left.keys(), ...right.keys()])].sort((a, b) => a.localeCompare(b))
  const unchangedStudents: string[] = []
  const changedStudents: string[] = []
  const addedStudents: string[] = []
  const removedStudents: string[] = []

  for (const studentId of ids) {
    const before = left.get(studentId)
    const after = right.get(studentId)
    if (before === undefined && after !== undefined) addedStudents.push(studentId)
    else if (before !== undefined && after === undefined) removedStudents.push(studentId)
    else if (before === after) unchangedStudents.push(studentId)
    else changedStudents.push(studentId)
  }

  return { unchangedStudents, changedStudents, addedStudents, removedStudents }
}

export function comparePlanningScenarios(
  project: ClassGraphProject,
  leftScenarioId: string,
  rightScenarioId: string,
): PlanningScenarioComparison {
  const scenarios = project.planning?.scenarios ?? []
  const left = scenarios.find((scenario) => scenario.id === leftScenarioId)
  const right = scenarios.find((scenario) => scenario.id === rightScenarioId)
  if (!left) throw new Error(`CG-4032 unknown planning scenario: ${leftScenarioId}`)
  if (!right) throw new Error(`CG-4032 unknown planning scenario: ${rightScenarioId}`)

  const assignmentMembership = compareMembership(assignmentMap(left), assignmentMap(right))
  const groupChanges = compareMembership(groupMembership(left), groupMembership(right))

  const leftRuleIds = new Set(left.rules.map((rule) => rule.id))
  const rightRuleIds = new Set(right.rules.map((rule) => rule.id))
  const addedRuleIds = [...rightRuleIds]
    .filter((id) => !leftRuleIds.has(id))
    .sort((a, b) => a.localeCompare(b))
  const removedRuleIds = [...leftRuleIds]
    .filter((id) => !rightRuleIds.has(id))
    .sort((a, b) => a.localeCompare(b))

  return {
    leftScenarioId,
    rightScenarioId,
    assignments: {
      leftCount: left.assignments.length,
      rightCount: right.assignments.length,
      unchangedStudents: assignmentMembership.unchangedStudents,
      movedStudents: assignmentMembership.changedStudents,
      addedStudents: assignmentMembership.addedStudents,
      removedStudents: assignmentMembership.removedStudents,
    },
    groups: {
      leftCount: left.groups.length,
      rightCount: right.groups.length,
      ...groupChanges,
    },
    rules: {
      leftCount: left.rules.length,
      rightCount: right.rules.length,
      addedRuleIds,
      removedRuleIds,
    },
    network: compareGroupNetworks(project.relationships ?? [], left.groups, right.groups),
  }
}
