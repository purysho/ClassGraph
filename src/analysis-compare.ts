import type { ClassGraphProject, MetricDefinition, MetricValue, StudentRecord } from './model.js'

/**
 * Multi-metric descriptive comparisons (DESIGN.md §6).
 *
 * Every view here describes the data the teacher explicitly selected. Explicitly missing and
 * not-recorded values remain separate levels; nothing is imputed, and association figures carry
 * a non-causation caveat.
 */

export const ASSOCIATION_CAVEAT =
  'Association is not causation. This figure describes how the recorded values move together in this class only.'

export type ValueState = 'recorded' | 'missing' | 'not-recorded'

export interface ComparisonLevel {
  key: string
  label: string
  state: ValueState
}

export interface CrossTabView {
  rowMetricKey: string
  columnMetricKey: string
  rowLabel: string
  columnLabel: string
  rows: ComparisonLevel[]
  columns: ComparisonLevel[]
  /** counts[rowIndex][columnIndex] */
  counts: number[][]
  rowTotals: number[]
  columnTotals: number[]
  studentCount: number
  /** Students with recorded values for both selected metrics. */
  bothRecordedCount: number
}

export interface PearsonAssociation {
  method: 'pearson'
  pairCount: number
  coefficient: number | null
  direction: 'positive' | 'negative' | 'none' | null
  unavailableReason?: 'too-few-pairs' | 'no-variation'
  caveat: string
}

export type GroupingBasis = 'tag' | 'planning-group'

export interface ComparisonSegment {
  key: string
  label: string
  /** True for the "No tags" / "Not in a group" remainder segment. */
  remainder: boolean
  studentCount: number
}

export interface NumericSegmentSummary {
  segment: ComparisonSegment
  recordedCount: number
  missingCount: number
  notRecordedCount: number
  min: number | null
  median: number | null
  mean: number | null
  max: number | null
}

export interface CategorySegmentSummary {
  segment: ComparisonSegment
  /** Aligned with GroupSummaryView.levels. */
  counts: number[]
}

interface GroupSummaryBase {
  metricKey: string
  metricLabel: string
  basis: GroupingBasis
  /** True when one student can appear in more than one segment (tags overlap). */
  overlapping: boolean
  studentCount: number
}

export type GroupSummaryView =
  | (GroupSummaryBase & { metricKind: 'number'; segments: NumericSegmentSummary[] })
  | (GroupSummaryBase & {
      metricKind: 'category' | 'ordinal' | 'boolean'
      levels: ComparisonLevel[]
      segments: CategorySegmentSummary[]
    })

const MISSING_KEY = '__missing__'
const NOT_RECORDED_KEY = '__not_recorded__'
const REMAINDER_KEY = '__remainder__'

const MIN_ASSOCIATION_PAIRS = 3

type LevelledKind = 'category' | 'ordinal' | 'boolean'

function findDefinition(project: ClassGraphProject, metricKey: string): MetricDefinition {
  const definition = project.metricDefinitions.find((item) => item.key === metricKey)
  if (!definition) throw new Error(`CG-3001 unknown metric: ${metricKey}`)
  return definition
}

function isLevelledKind(kind: MetricDefinition['kind']): kind is LevelledKind {
  return kind === 'category' || kind === 'ordinal' || kind === 'boolean'
}

function cellState(student: StudentRecord, metricKey: string): ValueState {
  if (!(metricKey in student.metrics)) return 'not-recorded'
  return student.metrics[metricKey] === null ? 'missing' : 'recorded'
}

function recordedKey(value: Exclude<MetricValue, null>): string {
  return `v:${String(value)}`
}

function levelKeyFor(student: StudentRecord, metricKey: string): string {
  const state = cellState(student, metricKey)
  if (state === 'not-recorded') return NOT_RECORDED_KEY
  if (state === 'missing') return MISSING_KEY
  return recordedKey(student.metrics[metricKey] as Exclude<MetricValue, null>)
}

function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

/**
 * Deterministic levels for a category/ordinal/boolean metric: the authored scale first, then
 * any other observed values in sorted order, then explicit missing and not-recorded levels when
 * they occur.
 */
function buildLevels(project: ClassGraphProject, definition: MetricDefinition): ComparisonLevel[] {
  const authored: Array<{ key: string; label: string }> =
    definition.kind === 'boolean'
      ? [
          { key: recordedKey(true), label: 'Yes' },
          { key: recordedKey(false), label: 'No' },
        ]
      : (
          (definition.kind === 'ordinal' ? definition.ordinalScale : definition.categories) ?? []
        ).map((value) => ({ key: recordedKey(value), label: value }))

  const known = new Set(authored.map((level) => level.key))
  const extra = new Map<string, string>()
  let hasMissing = false
  let hasNotRecorded = false

  for (const student of project.students) {
    const state = cellState(student, definition.key)
    if (state === 'missing') hasMissing = true
    else if (state === 'not-recorded') hasNotRecorded = true
    else {
      const value = student.metrics[definition.key] as Exclude<MetricValue, null>
      const key = recordedKey(value)
      if (!known.has(key)) extra.set(key, String(value))
    }
  }

  const levels: ComparisonLevel[] = [
    ...authored.map((level) => ({ ...level, state: 'recorded' as const })),
    ...[...extra.entries()]
      .sort(([a], [b]) => compareText(a, b))
      .map(([key, label]) => ({ key, label, state: 'recorded' as const })),
  ]
  if (hasMissing) levels.push({ key: MISSING_KEY, label: 'Missing', state: 'missing' })
  if (hasNotRecorded) {
    levels.push({ key: NOT_RECORDED_KEY, label: 'Not recorded', state: 'not-recorded' })
  }
  return levels
}

export function buildCrossTab(
  project: ClassGraphProject,
  rowMetricKey: string,
  columnMetricKey: string,
): CrossTabView {
  if (rowMetricKey === columnMetricKey) {
    throw new Error('CG-3007 cross-tabulation needs two different metrics')
  }
  const rowDefinition = findDefinition(project, rowMetricKey)
  const columnDefinition = findDefinition(project, columnMetricKey)
  for (const definition of [rowDefinition, columnDefinition]) {
    if (!isLevelledKind(definition.kind)) {
      throw new Error(
        `CG-3006 cross-tabulation needs category, ordinal or yes/no metrics: ${definition.key}`,
      )
    }
  }

  const rows = buildLevels(project, rowDefinition)
  const columns = buildLevels(project, columnDefinition)
  const rowIndex = new Map(rows.map((level, index) => [level.key, index]))
  const columnIndex = new Map(columns.map((level, index) => [level.key, index]))
  const counts = rows.map(() => columns.map(() => 0))
  let bothRecordedCount = 0

  for (const student of project.students) {
    const r = rowIndex.get(levelKeyFor(student, rowMetricKey))
    const c = columnIndex.get(levelKeyFor(student, columnMetricKey))
    if (r === undefined || c === undefined) continue
    const row = counts[r]
    if (row) row[c] = (row[c] ?? 0) + 1
    if (rows[r]?.state === 'recorded' && columns[c]?.state === 'recorded') bothRecordedCount += 1
  }

  return {
    rowMetricKey,
    columnMetricKey,
    rowLabel: rowDefinition.label,
    columnLabel: columnDefinition.label,
    rows,
    columns,
    counts,
    rowTotals: counts.map((row) => row.reduce((sum, value) => sum + value, 0)),
    columnTotals: columns.map((_, c) => counts.reduce((sum, row) => sum + (row[c] ?? 0), 0)),
    studentCount: project.students.length,
    bothRecordedCount,
  }
}

/** Pearson correlation over students with both values recorded. Never imputes. */
export function computePearsonAssociation(
  pairs: Array<{ x: number; y: number }>,
): PearsonAssociation {
  const pairCount = pairs.length
  const base = { method: 'pearson' as const, pairCount, caveat: ASSOCIATION_CAVEAT }
  if (pairCount < MIN_ASSOCIATION_PAIRS) {
    return { ...base, coefficient: null, direction: null, unavailableReason: 'too-few-pairs' }
  }

  const meanX = pairs.reduce((sum, pair) => sum + pair.x, 0) / pairCount
  const meanY = pairs.reduce((sum, pair) => sum + pair.y, 0) / pairCount
  let covariance = 0
  let varianceX = 0
  let varianceY = 0
  for (const { x, y } of pairs) {
    covariance += (x - meanX) * (y - meanY)
    varianceX += (x - meanX) ** 2
    varianceY += (y - meanY) ** 2
  }
  if (varianceX === 0 || varianceY === 0) {
    return { ...base, coefficient: null, direction: null, unavailableReason: 'no-variation' }
  }

  const raw = covariance / Math.sqrt(varianceX * varianceY)
  const coefficient = Math.max(-1, Math.min(1, Math.round(raw * 1000) / 1000))
  return {
    ...base,
    coefficient,
    direction: coefficient > 0 ? 'positive' : coefficient < 0 ? 'negative' : 'none',
  }
}

interface SegmentMembership {
  segment: ComparisonSegment
  students: StudentRecord[]
}

function buildSegments(project: ClassGraphProject, basis: GroupingBasis): SegmentMembership[] {
  const memberships: SegmentMembership[] = []
  const covered = new Set<string>()

  if (basis === 'tag') {
    const tags = [...new Set(project.students.flatMap((student) => student.tags ?? []))].sort(
      compareText,
    )
    for (const tag of tags) {
      const students = project.students.filter((student) => student.tags?.includes(tag))
      students.forEach((student) => covered.add(student.id))
      memberships.push({
        segment: { key: `tag:${tag}`, label: tag, remainder: false, studentCount: students.length },
        students,
      })
    }
  } else {
    const byId = new Map(project.students.map((student) => [student.id, student]))
    for (const group of project.planning?.groups ?? []) {
      const students = [...new Set(group.studentIds)]
        .map((id) => byId.get(id))
        .filter((student): student is StudentRecord => student !== undefined)
      students.forEach((student) => covered.add(student.id))
      memberships.push({
        segment: {
          key: `group:${group.id}`,
          label: group.label?.trim() || group.id,
          remainder: false,
          studentCount: students.length,
        },
        students,
      })
    }
  }

  const rest = project.students.filter((student) => !covered.has(student.id))
  if (rest.length > 0) {
    memberships.push({
      segment: {
        key: REMAINDER_KEY,
        label: basis === 'tag' ? 'No tags' : 'Not in a group',
        remainder: true,
        studentCount: rest.length,
      },
      students: rest,
    })
  }
  return memberships
}

function median(sorted: number[]): number | null {
  if (sorted.length === 0) return null
  const middle = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 1) return sorted[middle] ?? null
  const lower = sorted[middle - 1]
  const upper = sorted[middle]
  return lower === undefined || upper === undefined ? null : (lower + upper) / 2
}

function summariseNumericSegment(
  membership: SegmentMembership,
  metricKey: string,
): NumericSegmentSummary {
  const values: number[] = []
  let missingCount = 0
  let notRecordedCount = 0
  for (const student of membership.students) {
    const state = cellState(student, metricKey)
    const value = student.metrics[metricKey]
    if (state === 'not-recorded') notRecordedCount += 1
    else if (state === 'missing' || typeof value !== 'number') missingCount += 1
    else values.push(value)
  }
  values.sort((a, b) => a - b)
  return {
    segment: membership.segment,
    recordedCount: values.length,
    missingCount,
    notRecordedCount,
    min: values[0] ?? null,
    median: median(values),
    mean: values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : null,
    max: values.at(-1) ?? null,
  }
}

export function buildGroupSummary(
  project: ClassGraphProject,
  metricKey: string,
  basis: GroupingBasis,
): GroupSummaryView {
  const definition = findDefinition(project, metricKey)
  const memberships = buildSegments(project, basis)
  const base: GroupSummaryBase = {
    metricKey,
    metricLabel: definition.label,
    basis,
    overlapping:
      memberships.reduce((sum, membership) => sum + membership.students.length, 0) >
      project.students.length,
    studentCount: project.students.length,
  }

  if (definition.kind === 'number') {
    return {
      ...base,
      metricKind: 'number',
      segments: memberships.map((membership) => summariseNumericSegment(membership, metricKey)),
    }
  }

  if (!isLevelledKind(definition.kind)) {
    throw new Error(
      `CG-3008 group summaries need numeric, category, ordinal or yes/no metrics: ${metricKey}`,
    )
  }

  const levels = buildLevels(project, definition)
  const levelIndex = new Map(levels.map((level, index) => [level.key, index]))
  return {
    ...base,
    metricKind: definition.kind,
    levels,
    segments: memberships.map((membership) => {
      const counts = levels.map(() => 0)
      for (const student of membership.students) {
        const index = levelIndex.get(levelKeyFor(student, metricKey))
        if (index !== undefined) counts[index] = (counts[index] ?? 0) + 1
      }
      return { segment: membership.segment, counts }
    }),
  }
}
