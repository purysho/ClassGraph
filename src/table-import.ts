import type {
  ClassGraphProject,
  MetricDefinition,
  MetricKind,
  MetricValue,
  ProvenanceEntry,
  StudentRecord,
} from './model.js'
import { z } from 'zod'
import { classGraphProjectSchema } from './schema.js'
import { MAX_TABLE_COLUMNS, MAX_TABLE_ROWS, type TableCell } from './table-read.js'
import { createEmptyProject } from './workspace.js'

/**
 * Spreadsheet roster import: the teacher maps each column to a role, previews the result, then
 * applies it. Imported values carry `imported` provenance naming the file. Blank cells become
 * explicit missing values (null), never zero or false. When updating an existing class, a blank
 * cell never erases a value that is already recorded.
 */

export type ColumnMapping =
  | { role: 'ignore' }
  | { role: 'student-id' }
  | { role: 'display-name' }
  | { role: 'tags' }
  | {
      role: 'metric'
      metricKey: string
      label: string
      kind: MetricKind
      categories?: string[]
      ordinalScale?: string[]
      /** True when the column feeds a metric that already exists in the project. */
      existing?: boolean
    }

export interface TableImportRequest {
  sourceName: string
  rows: TableCell[][]
  headerRow: boolean
  columns: ColumnMapping[]
}

const cellSchema = z.union([z.string(), z.number().finite(), z.boolean(), z.null()])

const columnMappingSchema = z.discriminatedUnion('role', [
  z.object({ role: z.literal('ignore') }),
  z.object({ role: z.literal('student-id') }),
  z.object({ role: z.literal('display-name') }),
  z.object({ role: z.literal('tags') }),
  z.object({
    role: z.literal('metric'),
    metricKey: z.string().trim().min(1).max(80),
    label: z.string().trim().min(1).max(120),
    kind: z.enum(['number', 'ordinal', 'category', 'boolean', 'text']),
    categories: z.array(z.string().trim().min(1)).max(200).optional(),
    ordinalScale: z.array(z.string().trim().min(1)).max(200).optional(),
    existing: z.boolean().optional(),
  }),
])

export const tableImportRequestSchema = z.object({
  sourceName: z.string().trim().min(1).max(260),
  rows: z.array(z.array(cellSchema).max(MAX_TABLE_COLUMNS)).max(MAX_TABLE_ROWS + 1),
  headerRow: z.boolean(),
  columns: z.array(columnMappingSchema).max(MAX_TABLE_COLUMNS),
})

export function parseTableImportRequest(value: unknown): TableImportRequest {
  const result = tableImportRequestSchema.safeParse(value)
  if (!result.success) {
    const issue = result.error.issues[0]
    throw new Error(
      `CG-1001 invalid spreadsheet import${issue?.path.length ? ` at ${issue.path.join('.')}` : ''}: ${issue?.message ?? 'validation failed'}`,
    )
  }
  return result.data
}

export interface TableImportSuggestion {
  headerRow: boolean
  headers: string[]
  columns: ColumnMapping[]
}

export interface TableImportIssue {
  /** 1-based spreadsheet row number, when the issue belongs to a row. */
  row?: number
  column?: string
  message: string
}

export interface TableImportChange {
  studentId: string
  field: string
  from: string
  to: string
}

export interface TableImportPlan {
  mode: 'new-project' | 'merge'
  studentCount: number
  studentsAdded: number
  studentsUpdated: number
  /** Merge only: students already in the class but absent from the file (left unchanged). */
  studentsNotInFile: number
  newMetrics: MetricDefinition[]
  valueCount: number
  missingCount: number
  /** Merge only: blank cells that left an existing recorded value unchanged. */
  blanksKeptExisting: number
  generatedIds: boolean
  changes: TableImportChange[]
  errors: TableImportIssue[]
}

const MAX_CATEGORY_LEVELS = 12
const TAG_SEPARATOR = /[,;，；、|]/

const TRUE_WORDS = new Set(['true', 'yes', 'y', '是', '对', '✓', '√'])
const FALSE_WORDS = new Set(['false', 'no', 'n', '否', '不', '✗', '×'])

function importError(message: string): Error {
  return new Error(`CG-1102 ${message}`)
}

function cellText(cell: TableCell): string | null {
  if (cell === null) return null
  if (typeof cell === 'number') return String(cell)
  if (typeof cell === 'boolean') return cell ? 'true' : 'false'
  const trimmed = cell.trim()
  return trimmed === '' ? null : trimmed
}

function toHalfWidth(value: string): string {
  return value
    .replace(/[０-９]/g, (digit) => String.fromCharCode(digit.charCodeAt(0) - 0xfee0))
    .replace(/．/g, '.')
    .replace(/－/g, '-')
}

function parseNumber(cell: TableCell): number | null {
  if (typeof cell === 'number') return Number.isFinite(cell) ? cell : null
  const text = cellText(cell)
  if (text === null) return null
  const normalized = toHalfWidth(text).replace(/(?<=\d),(?=\d{3}(\D|$))/g, '')
  if (!/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(normalized)) return null
  const value = Number(normalized)
  return Number.isFinite(value) ? value : null
}

function parseBoolean(cell: TableCell): boolean | null {
  if (typeof cell === 'boolean') return cell
  const text = cellText(cell)?.toLowerCase()
  if (text === undefined || text === null) return null
  if (TRUE_WORDS.has(text)) return true
  if (FALSE_WORDS.has(text)) return false
  return null
}

function idText(cell: TableCell): string | null {
  if (typeof cell === 'number' && Number.isInteger(cell)) return String(cell)
  return cellText(cell)
}

const ID_HEADER = /^(student[\s_-]*)?(id|no\.?|number|code)$|^学号$|^学生编号$|^编号$|^学籍号$/i
const NAME_HEADER =
  /^((student|full|display)[\s_-]*)?name$|^student$|^姓名$|^学生姓名$|^名字$|^学生$/i
const TAGS_HEADER = /^tags?$|^labels?$|^标签$/i

function metricKeyFromHeader(header: string, index: number, used: Set<string>): string {
  const base =
    header
      .normalize('NFKD')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || `column-${index + 1}`
  let key = base
  let suffix = 2
  while (used.has(key)) {
    key = `${base}-${suffix}`
    suffix += 1
  }
  used.add(key)
  return key
}

/** Infers a metric kind from the recorded (non-blank) cells of one column. */
export function inferMetricKind(cells: TableCell[]): {
  kind: MetricKind
  categories?: string[]
} {
  const recorded = cells.filter((cell) => cellText(cell) !== null)
  if (recorded.length === 0) return { kind: 'text' }
  if (recorded.every((cell) => parseNumber(cell) !== null)) return { kind: 'number' }
  if (recorded.every((cell) => parseBoolean(cell) !== null)) return { kind: 'boolean' }
  // Dates (as read from .xlsx date cells or typed as 2024-09-01 / 2024/9/1) stay as text rather
  // than becoming a category whose levels are individual days.
  if (recorded.every((cell) => /^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}$/.test(cellText(cell) ?? ''))) {
    return { kind: 'text' }
  }
  const distinct = [...new Set(recorded.map((cell) => cellText(cell) as string))]
  if (distinct.length <= MAX_CATEGORY_LEVELS && distinct.length < recorded.length) {
    return { kind: 'category', categories: distinct }
  }
  return { kind: 'text' }
}

function looksLikeHeader(rows: TableCell[][]): boolean {
  const first = rows[0]
  if (!first || rows.length < 2) return false
  const filled = first.filter((cell) => cell !== null)
  return (
    filled.length > 0 &&
    filled.every((cell) => typeof cell === 'string') &&
    filled.some((cell) => parseNumber(cell) === null)
  )
}

function headerLabels(rows: TableCell[][], headerRow: boolean): string[] {
  const width = rows.reduce((max, row) => Math.max(max, row.length), 0)
  return Array.from({ length: width }, (_, index) => {
    const header = headerRow ? cellText(rows[0]?.[index] ?? null) : null
    return header ?? `Column ${index + 1}`
  })
}

function columnCells(rows: TableCell[][], headerRow: boolean, index: number): TableCell[] {
  return rows.slice(headerRow ? 1 : 0).map((row) => row[index] ?? null)
}

export function suggestTableImport(
  rows: TableCell[][],
  existing?: ClassGraphProject,
  headerRow = looksLikeHeader(rows),
): TableImportSuggestion {
  const headers = headerLabels(rows, headerRow)
  const usedKeys = new Set(existing?.metricDefinitions.map((metric) => metric.key) ?? [])
  const existingByLabel = new Map(
    (existing?.metricDefinitions ?? []).flatMap((metric) => [
      [metric.label.trim().toLowerCase(), metric],
      [metric.key.toLowerCase(), metric],
    ]),
  )
  let hasId = false
  let hasName = false
  let hasTags = false

  const columns = headers.map((header, index): ColumnMapping => {
    const cells = columnCells(rows, headerRow, index)
    if (cells.every((cell) => cellText(cell) === null)) return { role: 'ignore' }
    if (headerRow && !hasId && ID_HEADER.test(header)) {
      hasId = true
      return { role: 'student-id' }
    }
    if (headerRow && !hasName && NAME_HEADER.test(header)) {
      hasName = true
      return { role: 'display-name' }
    }
    if (headerRow && !hasTags && TAGS_HEADER.test(header)) {
      hasTags = true
      return { role: 'tags' }
    }
    const match = existingByLabel.get(header.trim().toLowerCase())
    if (match) {
      return {
        role: 'metric',
        metricKey: match.key,
        label: match.label,
        kind: match.kind,
        ...(match.categories ? { categories: [...match.categories] } : {}),
        ...(match.ordinalScale ? { ordinalScale: [...match.ordinalScale] } : {}),
        existing: true,
      }
    }
    const inferred = inferMetricKind(cells)
    return {
      role: 'metric',
      metricKey: metricKeyFromHeader(header, index, usedKeys),
      label: header,
      kind: inferred.kind,
      ...(inferred.categories ? { categories: inferred.categories } : {}),
    }
  })

  return { headerRow, headers, columns }
}

// ---------------------------------------------------------------------------------------------
// Planning

interface ParsedRow {
  rowNumber: number
  id: string
  displayName?: string
  tags?: string[]
  values: Map<string, MetricValue>
}

interface PreparedImport {
  plan: TableImportPlan
  rows: ParsedRow[]
  metricColumns: Array<{ index: number; mapping: Extract<ColumnMapping, { role: 'metric' }> }>
}

function describe(value: MetricValue | undefined): string {
  if (value === undefined) return 'Not recorded'
  if (value === null) return 'Missing'
  return String(value)
}

function definitionFor(mapping: Extract<ColumnMapping, { role: 'metric' }>): MetricDefinition {
  return {
    key: mapping.metricKey,
    label: mapping.label,
    kind: mapping.kind,
    ...(mapping.kind === 'category' ? { categories: mapping.categories ?? [] } : {}),
    ...(mapping.kind === 'ordinal' ? { ordinalScale: mapping.ordinalScale ?? [] } : {}),
  }
}

function convertCell(
  cell: TableCell,
  definition: MetricDefinition,
): { value: MetricValue } | { error: string } {
  if (cellText(cell) === null) return { value: null }
  const shown = cellText(cell) as string
  switch (definition.kind) {
    case 'number': {
      const value = parseNumber(cell)
      return value === null ? { error: `"${shown}" is not a number` } : { value }
    }
    case 'boolean': {
      const value = parseBoolean(cell)
      return value === null ? { error: `"${shown}" is not yes/no` } : { value }
    }
    case 'category':
      return definition.categories?.includes(shown)
        ? { value: shown }
        : {
            error: `"${shown}" is not one of the categories (${definition.categories?.join(', ') ?? ''})`,
          }
    case 'ordinal':
      return definition.ordinalScale?.includes(shown)
        ? { value: shown }
        : { error: `"${shown}" is not on the scale (${definition.ordinalScale?.join(', ') ?? ''})` }
    case 'text':
      return { value: shown }
  }
}

function prepare(request: TableImportRequest, existing?: ClassGraphProject): PreparedImport {
  const errors: TableImportIssue[] = []
  const headers = headerLabels(request.rows, request.headerRow)
  const roleIndex = (role: ColumnMapping['role']) =>
    request.columns.flatMap((mapping, index) => (mapping.role === role ? [index] : []))

  for (const role of ['student-id', 'display-name', 'tags'] as const) {
    if (roleIndex(role).length > 1) errors.push({ message: `Only one column can be the ${role}.` })
  }
  const idColumn = roleIndex('student-id')[0]
  if (existing && idColumn === undefined) {
    errors.push({
      message: 'Updating an existing class needs a student ID column to match students.',
    })
  }

  const metricColumns = request.columns.flatMap((mapping, index) =>
    mapping.role === 'metric' ? [{ index, mapping }] : [],
  )
  if (request.columns.length > 0 && request.columns.every((mapping) => mapping.role === 'ignore')) {
    errors.push({ message: 'Choose at least one column to import.' })
  }

  const definitions = new Map<string, MetricDefinition>(
    (existing?.metricDefinitions ?? []).map((metric) => [metric.key, metric]),
  )
  const seenKeys = new Set<string>()
  const newMetrics: MetricDefinition[] = []
  for (const { mapping } of metricColumns) {
    if (seenKeys.has(mapping.metricKey)) {
      errors.push({
        column: mapping.label,
        message: `Two columns use the metric key "${mapping.metricKey}".`,
      })
    }
    seenKeys.add(mapping.metricKey)
    const current = definitions.get(mapping.metricKey)
    if (current) {
      if (!mapping.existing || current.kind !== mapping.kind) {
        errors.push({
          column: mapping.label,
          message: `Metric key "${mapping.metricKey}" already exists as a ${current.kind} metric.`,
        })
      }
      continue
    }
    if (mapping.existing) {
      errors.push({
        column: mapping.label,
        message: `Metric "${mapping.metricKey}" is not in this class.`,
      })
      continue
    }
    if (!mapping.label.trim()) errors.push({ message: 'Every imported metric needs a label.' })
    const definition = definitionFor(mapping)
    if (definition.kind === 'category' && (definition.categories?.length ?? 0) === 0) {
      errors.push({
        column: mapping.label,
        message: 'A category metric needs at least one category.',
      })
    }
    if (definition.kind === 'ordinal' && (definition.ordinalScale?.length ?? 0) === 0) {
      errors.push({ column: mapping.label, message: 'An ordinal metric needs its scale in order.' })
    }
    definitions.set(definition.key, definition)
    newMetrics.push(definition)
  }

  const dataStart = request.headerRow ? 1 : 0
  const rows: ParsedRow[] = []
  const seenIds = new Map<string, number>()
  let generatedIds = false

  request.rows.slice(dataStart).forEach((cells, offset) => {
    const rowNumber = dataStart + offset + 1
    if (cells.every((cell) => cellText(cell) === null)) return

    let id: string | null
    if (idColumn === undefined) {
      id = `s${String(rows.length + 1).padStart(3, '0')}`
      generatedIds = true
    } else {
      id = idText(cells[idColumn] ?? null)
      if (id === null) {
        errors.push({
          row: rowNumber,
          column: headers[idColumn],
          message: 'This row has no student ID.',
        })
        return
      }
    }
    const duplicate = seenIds.get(id)
    if (duplicate !== undefined) {
      errors.push({
        row: rowNumber,
        message: `Student ID "${id}" also appears on row ${duplicate}.`,
      })
      return
    }
    seenIds.set(id, rowNumber)

    const parsed: ParsedRow = { rowNumber, id, values: new Map() }
    const nameColumn = roleIndex('display-name')[0]
    const name = nameColumn === undefined ? null : cellText(cells[nameColumn] ?? null)
    if (name !== null) parsed.displayName = name
    const tagColumn = roleIndex('tags')[0]
    const tagText = tagColumn === undefined ? null : cellText(cells[tagColumn] ?? null)
    if (tagText !== null) {
      parsed.tags = [
        ...new Set(
          tagText
            .split(TAG_SEPARATOR)
            .map((tag) => tag.trim())
            .filter(Boolean),
        ),
      ]
    }

    for (const { index, mapping } of metricColumns) {
      const definition = definitions.get(mapping.metricKey)
      if (!definition) continue
      const result = convertCell(cells[index] ?? null, definition)
      if ('error' in result) {
        errors.push({ row: rowNumber, column: headers[index], message: result.error })
      } else {
        parsed.values.set(mapping.metricKey, result.value)
      }
    }
    rows.push(parsed)
  })

  if (rows.length === 0 && errors.length === 0)
    errors.push({ message: 'The sheet has no student rows.' })

  // Counts and merge comparison.
  const existingById = new Map(existing?.students.map((student) => [student.id, student]) ?? [])
  let valueCount = 0
  let missingCount = 0
  let blanksKeptExisting = 0
  let studentsUpdated = 0
  const changes: TableImportChange[] = []

  for (const row of rows) {
    const current = existingById.get(row.id)
    if (current) studentsUpdated += 1
    if (current && row.displayName !== undefined && current.displayName !== row.displayName) {
      changes.push({
        studentId: row.id,
        field: 'Name',
        from: current.displayName ?? 'Not recorded',
        to: row.displayName,
      })
    }
    for (const [key, value] of row.values) {
      const before = current?.metrics[key]
      if (value === null && current && before !== undefined && before !== null) {
        blanksKeptExisting += 1
        continue
      }
      if (value === null) missingCount += 1
      else valueCount += 1
      if (current && before !== undefined && before !== value) {
        changes.push({
          studentId: row.id,
          field: definitions.get(key)?.label ?? key,
          from: describe(before),
          to: describe(value),
        })
      }
    }
  }

  return {
    rows,
    metricColumns,
    plan: {
      mode: existing ? 'merge' : 'new-project',
      studentCount: rows.length,
      studentsAdded: rows.length - studentsUpdated,
      studentsUpdated,
      studentsNotInFile: existing
        ? existing.students.filter((student) => !seenIds.has(student.id)).length
        : 0,
      newMetrics,
      valueCount,
      missingCount,
      blanksKeptExisting,
      generatedIds,
      changes,
      errors,
    },
  }
}

export function planTableImport(
  request: TableImportRequest,
  existing?: ClassGraphProject,
): TableImportPlan {
  return prepare(request, existing).plan
}

// ---------------------------------------------------------------------------------------------
// Applying

export type TableImportTarget =
  | { mode: 'new-project'; projectId: string; title: string; now: string }
  | { mode: 'merge'; project: ClassGraphProject; now: string }

export function applyTableImport(
  request: TableImportRequest,
  target: TableImportTarget,
): ClassGraphProject {
  const existing = target.mode === 'merge' ? target.project : undefined
  const { plan, rows } = prepare(request, existing)
  if (plan.errors.length > 0) {
    const first = plan.errors[0]
    throw importError(
      `the spreadsheet has ${plan.errors.length} problem(s) to fix first${first ? `: ${first.row ? `row ${first.row}: ` : ''}${first.message}` : ''}`,
    )
  }

  const project =
    target.mode === 'merge'
      ? structuredClone(target.project)
      : createEmptyProject({ projectId: target.projectId, title: target.title, now: target.now })
  const provenance: ProvenanceEntry = {
    kind: 'imported',
    source: `spreadsheet:${request.sourceName}`,
  }

  for (const definition of plan.newMetrics) {
    project.metricDefinitions.push(structuredClone(definition))
    project.provenance[`/metricDefinitions/${project.metricDefinitions.length - 1}`] = provenance
  }

  const indexById = new Map(project.students.map((student, index) => [student.id, index]))
  for (const row of rows) {
    let index = indexById.get(row.id)
    if (index === undefined) {
      const student: StudentRecord = { id: row.id, metrics: {} }
      project.students.push(student)
      index = project.students.length - 1
      indexById.set(row.id, index)
      project.provenance[`/students/${index}/id`] = provenance
    }
    const student = project.students[index] as StudentRecord
    if (row.displayName !== undefined) {
      student.displayName = row.displayName
      project.provenance[`/students/${index}/displayName`] = provenance
    }
    if (row.tags !== undefined) {
      student.tags = row.tags
      project.provenance[`/students/${index}/tags`] = provenance
    }
    for (const [key, value] of row.values) {
      const before = student.metrics[key]
      if (value === null && before !== undefined && before !== null) continue
      student.metrics[key] = value
      project.provenance[`/students/${index}/metrics/${key}`] = provenance
    }
  }

  project.updatedAt = target.now
  return classGraphProjectSchema.parse(project)
}
