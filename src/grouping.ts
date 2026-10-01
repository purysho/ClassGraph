import type { ClassGraphProject, PlanningGroup } from './model.js'
import { deterministicUnit } from './random.js'

export interface GroupObjectiveResult {
  kind: 'size-balance' | 'metric-balance'
  penalty: number
  details: string
}

export interface GroupingCandidate {
  id: string
  seed: string
  groups: PlanningGroup[]
  objectiveResults: GroupObjectiveResult[]
  totalPenalty: number
  explanation: string[]
}

export interface GroupingGenerationResult {
  seed: string
  candidates: GroupingCandidate[]
  attempts: number
}

export interface GroupingGenerationOptions {
  groupCount: number
  seed?: string
  metricKey?: string
  candidateCount?: number
  attempts?: number
}

function metricNumericValue(
  project: ClassGraphProject,
  studentId: string,
  metricKey: string,
): number | undefined {
  const definition = project.metricDefinitions.find((item) => item.key === metricKey)
  const student = project.students.find((item) => item.id === studentId)
  const value = student?.metrics[metricKey]
  if (definition?.kind === 'number' && typeof value === 'number') return value
  if (definition?.kind === 'ordinal' && typeof value === 'string') {
    const index = definition.ordinalScale?.indexOf(value) ?? -1
    return index >= 0 ? index + 1 : undefined
  }
  return undefined
}

function validateOptions(project: ClassGraphProject, options: GroupingGenerationOptions): void {
  if (!Number.isInteger(options.groupCount) || options.groupCount < 2) {
    throw new Error('CG-4020 group count must be an integer of at least 2')
  }
  if (options.groupCount > Math.max(2, project.students.length)) {
    throw new Error('CG-4021 group count cannot exceed the student count')
  }
  if (options.metricKey) {
    const definition = project.metricDefinitions.find((item) => item.key === options.metricKey)
    if (!definition || !['number', 'ordinal'].includes(definition.kind)) {
      throw new Error(
        `CG-4022 grouping balance requires a numeric or ordinal metric: ${options.metricKey}`,
      )
    }
  }
}

function baseGroupIds(project: ClassGraphProject, groupCount: number): string[] {
  const existing = project.planning?.groups ?? []
  if (existing.length === groupCount) return existing.map((group) => group.id)
  return Array.from({ length: groupCount }, (_, index) => `group-${index + 1}`)
}

function lockedMembership(project: ClassGraphProject): Map<string, string> {
  const result = new Map<string, string>()
  for (const group of project.planning?.groups ?? []) {
    for (const studentId of group.lockedStudentIds ?? []) result.set(studentId, group.id)
  }
  return result
}

function groupSignature(groups: PlanningGroup[]): string {
  return groups
    .map((group) => `${group.id}:${[...group.studentIds].sort().join(',')}`)
    .sort()
    .join('|')
}

function groupObjectiveResults(
  project: ClassGraphProject,
  groups: PlanningGroup[],
  metricKey?: string,
): GroupObjectiveResult[] {
  const sizes = groups.map((group) => group.studentIds.length)
  const sizeSpread = sizes.length ? Math.max(...sizes) - Math.min(...sizes) : 0
  const results: GroupObjectiveResult[] = [
    {
      kind: 'size-balance',
      penalty: sizeSpread,
      details: `Largest-smallest group size difference is ${sizeSpread}.`,
    },
  ]

  if (!metricKey) return results

  let missing = 0
  const means = groups
    .map((group) => {
      const values = group.studentIds
        .map((studentId) => metricNumericValue(project, studentId, metricKey))
        .filter((value): value is number => value !== undefined)
      missing += group.studentIds.length - values.length
      if (values.length === 0) return undefined
      return values.reduce((sum, value) => sum + value, 0) / values.length
    })
    .filter((value): value is number => value !== undefined)

  const spread = means.length > 1 ? Math.max(...means) - Math.min(...means) : 0
  results.push({
    kind: 'metric-balance',
    penalty: spread,
    details: `Group mean spread for ${metricKey} is ${spread.toFixed(2)}; ${missing} student(s) lacked a recorded value and were ignored.`,
  })
  return results
}

function buildCandidate(
  project: ClassGraphProject,
  options: GroupingGenerationOptions,
  seed: string,
  attempt: number,
): GroupingCandidate {
  const ids = baseGroupIds(project, options.groupCount)
  const locked = lockedMembership(project)
  const groups = ids.map<PlanningGroup>((id, index) => {
    const previous = project.planning?.groups?.find((group) => group.id === id)
    return {
      id,
      label: previous?.label ?? `Group ${index + 1}`,
      studentIds: [],
      lockedStudentIds: [],
    }
  })
  const groupMap = new Map(groups.map((group) => [group.id, group]))

  for (const [studentId, groupId] of locked) {
    const group = groupMap.get(groupId)
    if (group) {
      group.studentIds.push(studentId)
      group.lockedStudentIds?.push(studentId)
    }
  }

  const remaining = project.students
    .filter((student) => !locked.has(student.id))
    .sort((a, b) => {
      const score =
        deterministicUnit(seed, `group:${attempt}:student:${a.id}`) -
        deterministicUnit(seed, `group:${attempt}:student:${b.id}`)
      return score || a.id.localeCompare(b.id)
    })

  for (const student of remaining) {
    const orderedGroups = [...groups].sort((a, b) => {
      const sizeDifference = a.studentIds.length - b.studentIds.length
      if (sizeDifference !== 0) return sizeDifference
      const score =
        deterministicUnit(seed, `group:${attempt}:${student.id}:${a.id}`) -
        deterministicUnit(seed, `group:${attempt}:${student.id}:${b.id}`)
      return score || a.id.localeCompare(b.id)
    })
    orderedGroups[0]?.studentIds.push(student.id)
  }

  const objectiveResults = groupObjectiveResults(project, groups, options.metricKey)
  const totalPenalty = objectiveResults.reduce((sum, result) => sum + result.penalty, 0)
  return {
    id: `group-candidate-${attempt + 1}`,
    seed,
    groups,
    objectiveResults,
    totalPenalty,
    explanation: objectiveResults.map(
      (result) => `${result.kind} penalty ${result.penalty.toFixed(2)}: ${result.details}`,
    ),
  }
}

export function generateGroupingCandidates(
  project: ClassGraphProject,
  options: GroupingGenerationOptions,
): GroupingGenerationResult {
  validateOptions(project, options)
  const seed = options.seed?.trim() || project.planning?.seed?.trim() || 'classgraph-grouping'
  const candidateCount = Math.max(1, Math.min(10, options.candidateCount ?? 3))
  const attempts = Math.max(candidateCount, Math.min(2000, options.attempts ?? 250))
  const distinct = new Map<string, GroupingCandidate>()

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const candidate = buildCandidate(project, options, seed, attempt)
    const signature = groupSignature(candidate.groups)
    const previous = distinct.get(signature)
    if (!previous || candidate.totalPenalty < previous.totalPenalty)
      distinct.set(signature, candidate)
  }

  const candidates = [...distinct.values()]
    .sort(
      (left, right) =>
        left.totalPenalty - right.totalPenalty ||
        groupSignature(left.groups).localeCompare(groupSignature(right.groups)),
    )
    .slice(0, candidateCount)
    .map((candidate, index) => ({ ...candidate, id: `group-candidate-${index + 1}` }))

  return { seed, candidates, attempts }
}
