/**
 * Side-by-side comparison of two terms of the same class: two ClassGraph projects whose students
 * are matched by student ID.
 *
 * Strictly descriptive. It reports what was recorded in each term and how matched values differ.
 * It never ranks students, labels a change as better or worse, or guesses why values changed.
 * Missing and not-recorded values are never filled in: a student without a recorded value in
 * both terms is counted as "not compared" for that metric.
 */
import type { ClassGraphProject, MetricDefinition, MetricValue, StudentRecord } from './model.js'
import { classGraphProjectSchema } from './schema.js'

export type TermValueState = 'recorded' | 'missing' | 'not-recorded' | 'not-in-term'

export interface TermValue {
  state: TermValueState
  value: number | string | boolean | null
}

export interface TermLabel {
  projectId: string
  title: string
  term: string | null
  updatedAt: string
  studentCount: number
}

export interface TermStudent {
  id: string
  earlierName: string | null
  laterName: string | null
}

export type NotComparedReason =
  'only-earlier' | 'only-later' | 'kind-changed' | 'scale-changed' | 'text'

export interface NotComparedMetric {
  key: string
  earlierLabel: string | null
  laterLabel: string | null
  reason: NotComparedReason
}

export interface TermSideSummary {
  recordedCount: number
  missingCount: number
  notRecordedCount: number
  /** Numbers only. */
  median: number | null
  mean: number | null
  min: number | null
  max: number | null
  /** Ordinal, category and yes/no: how many students had each value. */
  counts: Record<string, number>
}

export interface TermStudentRow {
  studentId: string
  earlier: TermValue
  later: TermValue
  /** Later minus earlier for numbers, scale steps for ordinal metrics; null when not compared. */
  change: number | null
}

export interface TermMetricComparison {
  key: string
  earlierLabel: string
  laterLabel: string
  kind: 'number' | 'ordinal' | 'category' | 'boolean'
  unit: string | null
  /** The order values are listed in: the ordinal scale, or categories as first seen. */
  levels: string[]
  earlier: TermSideSummary
  later: TermSideSummary
  /** Students in both terms with a recorded value in both. */
  pairCount: number
  /** Students in both terms without a recorded value in one or both. */
  notComparedCount: number
  /** Ordered values only (numbers, ordinal): later value above, below or equal to earlier. */
  higherCount: number
  lowerCount: number
  sameCount: number
  /** Every kind: pairs whose value differs between the terms. */
  changedCount: number
  /** Numbers: change across matched pairs. Ordinal: steps on the scale. */
  medianChange: number | null
  meanChange: number | null
  /** Category, yes/no and ordinal: earlier value → later value → number of students. */
  transitions: Record<string, Record<string, number>>
  rows: TermStudentRow[]
}

export interface TermComparison {
  earlier: TermLabel
  later: TermLabel
  students: TermStudent[]
  roster: { bothCount: number; onlyEarlier: string[]; onlyLater: string[] }
  metrics: TermMetricComparison[]
  notCompared: NotComparedMetric[]
}

function label(project: ClassGraphProject): TermLabel {
  return {
    projectId: project.projectId,
    title: project.title,
    term: project.classInfo?.term?.trim() || null,
    updatedAt: project.updatedAt,
    studentCount: project.students.length,
  }
}

function valueOf(student: StudentRecord | undefined, key: string): TermValue {
  if (!student) return { state: 'not-in-term', value: null }
  if (!Object.hasOwn(student.metrics, key)) return { state: 'not-recorded', value: null }
  const value = student.metrics[key] as MetricValue
  return value === null ? { state: 'missing', value: null } : { state: 'recorded', value }
}

function median(sorted: number[]): number | null {
  if (sorted.length === 0) return null
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2
}

function mean(values: number[]): number | null {
  return values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length
}

function summarise(project: ClassGraphProject, definition: MetricDefinition): TermSideSummary {
  const summary: TermSideSummary = {
    recordedCount: 0,
    missingCount: 0,
    notRecordedCount: 0,
    median: null,
    mean: null,
    min: null,
    max: null,
    counts: {},
  }
  const numbers: number[] = []
  for (const student of project.students) {
    const { state, value } = valueOf(student, definition.key)
    if (state === 'missing') summary.missingCount += 1
    else if (state === 'not-recorded') summary.notRecordedCount += 1
    else if (state === 'recorded') {
      summary.recordedCount += 1
      if (definition.kind === 'number' && typeof value === 'number') numbers.push(value)
      else summary.counts[String(value)] = (summary.counts[String(value)] ?? 0) + 1
    }
  }
  if (definition.kind === 'number') {
    numbers.sort((a, b) => a - b)
    summary.median = median(numbers)
    summary.mean = mean(numbers)
    summary.min = numbers[0] ?? null
    summary.max = numbers.at(-1) ?? null
  }
  return summary
}

function sameList(a: string[] | undefined, b: string[] | undefined): boolean {
  const left = a ?? []
  const right = b ?? []
  return left.length === right.length && left.every((item, index) => item === right[index])
}

function comparability(
  earlier: MetricDefinition,
  later: MetricDefinition,
): NotComparedReason | null {
  if (earlier.kind !== later.kind) return 'kind-changed'
  if (earlier.kind === 'text') return 'text'
  if (earlier.kind === 'ordinal' && !sameList(earlier.ordinalScale, later.ordinalScale)) {
    return 'scale-changed'
  }
  if (earlier.kind === 'number') {
    const a = earlier.numberScale ?? {}
    const b = later.numberScale ?? {}
    if (a.min !== b.min || a.max !== b.max || (a.unit ?? '') !== (b.unit ?? '')) {
      return 'scale-changed'
    }
  }
  return null
}

function levelsFor(
  definition: MetricDefinition,
  earlier: TermSideSummary,
  later: TermSideSummary,
): string[] {
  if (definition.kind === 'ordinal') return [...(definition.ordinalScale ?? [])]
  if (definition.kind === 'boolean') return ['true', 'false']
  const seen = [...(definition.categories ?? [])]
  for (const value of [...Object.keys(earlier.counts), ...Object.keys(later.counts)]) {
    if (!seen.includes(value)) seen.push(value)
  }
  return seen
}

function compareMetric(
  earlierProject: ClassGraphProject,
  laterProject: ClassGraphProject,
  earlierDefinition: MetricDefinition,
  laterDefinition: MetricDefinition,
  matchedIds: string[],
  earlierById: Map<string, StudentRecord>,
  laterById: Map<string, StudentRecord>,
  allIds: string[],
): TermMetricComparison {
  const kind = earlierDefinition.kind as TermMetricComparison['kind']
  const earlier = summarise(earlierProject, earlierDefinition)
  const later = summarise(laterProject, laterDefinition)
  const levels = levelsFor(earlierDefinition, earlier, later)
  const matched = new Set(matchedIds)

  const changes: number[] = []
  let notComparedCount = 0
  const transitions: Record<string, Record<string, number>> = {}
  const rows: TermStudentRow[] = []

  for (const id of allIds) {
    const before = valueOf(earlierById.get(id), earlierDefinition.key)
    const after = valueOf(laterById.get(id), laterDefinition.key)
    let change: number | null = null

    if (matched.has(id)) {
      if (before.state === 'recorded' && after.state === 'recorded') {
        if (
          kind === 'number' &&
          typeof before.value === 'number' &&
          typeof after.value === 'number'
        ) {
          change = after.value - before.value
        } else if (kind === 'ordinal') {
          const from = levels.indexOf(String(before.value))
          const to = levels.indexOf(String(after.value))
          if (from >= 0 && to >= 0) change = to - from
        }
        if (kind !== 'number') {
          const from = String(before.value)
          const to = String(after.value)
          transitions[from] ??= {}
          transitions[from][to] = (transitions[from][to] ?? 0) + 1
        }
        if (change !== null) changes.push(change)
      } else {
        notComparedCount += 1
      }
    }
    rows.push({ studentId: id, earlier: before, later: after, change })
  }

  const pairCount = matchedIds.length - notComparedCount
  const sortedChanges = [...changes].sort((a, b) => a - b)
  const ordered = kind === 'number' || kind === 'ordinal'
  const changedUnordered = Object.entries(transitions).reduce(
    (total, [from, row]) =>
      total + Object.entries(row).reduce((sum, [to, n]) => sum + (to === from ? 0 : n), 0),
    0,
  )
  const higherCount = ordered ? changes.filter((value) => value > 0).length : 0
  const lowerCount = ordered ? changes.filter((value) => value < 0).length : 0

  return {
    key: earlierDefinition.key,
    earlierLabel: earlierDefinition.label,
    laterLabel: laterDefinition.label,
    kind,
    unit: earlierDefinition.numberScale?.unit ?? null,
    levels,
    earlier,
    later,
    pairCount,
    notComparedCount,
    higherCount,
    lowerCount,
    sameCount: ordered
      ? changes.filter((value) => value === 0).length
      : pairCount - changedUnordered,
    changedCount: ordered ? higherCount + lowerCount : changedUnordered,
    medianChange: median(sortedChanges),
    meanChange: mean(changes),
    transitions,
    rows,
  }
}

/** Compares two terms of a class. Students are matched by ID only, never by name. */
export function compareTerms(
  earlierProject: ClassGraphProject,
  laterProject: ClassGraphProject,
): TermComparison {
  const earlierById = new Map(earlierProject.students.map((student) => [student.id, student]))
  const laterById = new Map(laterProject.students.map((student) => [student.id, student]))

  const allIds = [
    ...laterProject.students.map((student) => student.id),
    ...earlierProject.students.map((student) => student.id).filter((id) => !laterById.has(id)),
  ]
  const matchedIds = allIds.filter((id) => earlierById.has(id) && laterById.has(id))

  const students = allIds.map((id) => ({
    id,
    earlierName: earlierById.get(id)?.displayName ?? null,
    laterName: laterById.get(id)?.displayName ?? null,
  }))

  const earlierDefinitions = new Map(
    earlierProject.metricDefinitions.map((definition) => [definition.key, definition]),
  )
  const laterDefinitions = new Map(
    laterProject.metricDefinitions.map((definition) => [definition.key, definition]),
  )

  const metrics: TermMetricComparison[] = []
  const notCompared: NotComparedMetric[] = []

  for (const later of laterProject.metricDefinitions) {
    const earlier = earlierDefinitions.get(later.key)
    if (!earlier) {
      notCompared.push({
        key: later.key,
        earlierLabel: null,
        laterLabel: later.label,
        reason: 'only-later',
      })
      continue
    }
    const reason = comparability(earlier, later)
    if (reason) {
      notCompared.push({
        key: later.key,
        earlierLabel: earlier.label,
        laterLabel: later.label,
        reason,
      })
      continue
    }
    metrics.push(
      compareMetric(
        earlierProject,
        laterProject,
        earlier,
        later,
        matchedIds,
        earlierById,
        laterById,
        allIds,
      ),
    )
  }
  for (const earlier of earlierProject.metricDefinitions) {
    if (!laterDefinitions.has(earlier.key)) {
      notCompared.push({
        key: earlier.key,
        earlierLabel: earlier.label,
        laterLabel: null,
        reason: 'only-earlier',
      })
    }
  }

  return {
    earlier: label(earlierProject),
    later: label(laterProject),
    students,
    roster: {
      bothCount: matchedIds.length,
      onlyEarlier: allIds.filter((id) => earlierById.has(id) && !laterById.has(id)),
      onlyLater: allIds.filter((id) => laterById.has(id) && !earlierById.has(id)),
    },
    metrics,
    notCompared,
  }
}

function csvCell(value: string): string {
  // Leading = + - @ would be read as a formula by spreadsheet software.
  // Plain numbers such as -2 are left alone.
  const safe = /^[=+\-@\t\r]/.test(value) && !/^-?\d+(\.\d+)?$/.test(value) ? `'${value}` : value
  return /[",\n\r]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe
}

function cellValue(value: TermValue): string {
  if (value.state === 'recorded') return String(value.value)
  return value.state
}

/**
 * One row per student, with the earlier value, the later value and (where it applies) the change
 * for every compared metric. Missing, not-recorded, not-in-term and not-compared are written as
 * those words, so a blank cell never stands in for a value. Starts with a UTF-8 byte order mark so Excel reads
 * Chinese names correctly.
 */
export function termComparisonCsv(comparison: TermComparison): string {
  const header = ['student_id', 'earlier_name', 'later_name']
  for (const metric of comparison.metrics) {
    header.push(`${metric.key}_earlier`, `${metric.key}_later`)
    if (metric.kind === 'number' || metric.kind === 'ordinal') header.push(`${metric.key}_change`)
  }

  const lines = [header.map(csvCell).join(',')]
  comparison.students.forEach((student, index) => {
    const row = [student.id, student.earlierName ?? '', student.laterName ?? '']
    for (const metric of comparison.metrics) {
      const entry = metric.rows[index]!
      row.push(cellValue(entry.earlier), cellValue(entry.later))
      if (metric.kind === 'number' || metric.kind === 'ordinal') {
        row.push(
          entry.change === null ? 'not-compared' : String(Math.round(entry.change * 1e6) / 1e6),
        )
      }
    }
    lines.push(row.map(csvCell).join(','))
  })
  return `\uFEFF${lines.join('\r\n')}\r\n`
}

export interface NextTermInput {
  projectId: string
  title: string
  term: string
  now: string
}

/**
 * Starts a new term from a class: the same students (IDs, names, tags) and the same metric
 * definitions, so the two terms can be compared by student ID later. No values, seating, groups,
 * relationships or notes are carried over; the new term starts with nothing recorded.
 */
export function startNextTerm(source: ClassGraphProject, input: NextTermInput): ClassGraphProject {
  const projectId = input.projectId.trim()
  const title = input.title.trim()
  if (!projectId || !title) throw new Error('CG-1001 the new term needs a class ID and a name')
  if (projectId === source.projectId) {
    throw new Error('CG-1001 the new term needs its own class ID')
  }
  const origin = { kind: 'derived' as const, source: `next-term:${source.projectId}` }

  const project: ClassGraphProject = {
    schemaVersion: '1.0',
    projectId,
    title,
    createdAt: input.now,
    updatedAt: input.now,
    classInfo: structuredClone(source.classInfo ?? {}),
    metricDefinitions: structuredClone(source.metricDefinitions),
    students: source.students.map((student) => ({
      id: student.id,
      ...(student.displayName === undefined ? {} : { displayName: student.displayName }),
      ...(student.tags === undefined ? {} : { tags: [...student.tags] }),
      metrics: {},
    })),
    provenance: {
      '/projectId': { kind: 'teacher-entered', source: 'next-term-setup' },
      '/title': { kind: 'teacher-entered', source: 'next-term-setup' },
      '/classInfo': origin,
    },
  }
  const term = input.term.trim()
  if (term) project.classInfo = { ...project.classInfo, term }
  else delete project.classInfo?.term
  source.metricDefinitions.forEach((_, index) => {
    project.provenance[`/metricDefinitions/${index}`] = origin
  })
  project.students.forEach((_, index) => {
    project.provenance[`/students/${index}/id`] = origin
    if (project.students[index]?.displayName !== undefined) {
      project.provenance[`/students/${index}/displayName`] = origin
    }
    if (project.students[index]?.tags !== undefined) {
      project.provenance[`/students/${index}/tags`] = origin
    }
  })
  return classGraphProjectSchema.parse(project)
}
