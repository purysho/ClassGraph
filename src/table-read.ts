import JSZip from 'jszip'

/**
 * Reads CSV/TSV and .xlsx spreadsheets into plain rows of cells for roster import.
 *
 * Cells are `string | number | boolean | null`; `null` means the cell is blank. Nothing is
 * coerced here beyond what the file format itself says (an .xlsx number stays a number, a CSV
 * cell stays text). Type decisions happen in table-import.ts where the teacher can see them.
 */

export type TableCell = string | number | boolean | null

export interface TableSheet {
  name: string
  rows: TableCell[][]
}

export interface ReadTable {
  format: 'csv' | 'xlsx'
  /** For CSV: the text encoding that decoded the file. */
  encoding?: 'utf-8' | 'gb18030'
  sheets: TableSheet[]
}

export const MAX_TABLE_ROWS = 2000
export const MAX_TABLE_COLUMNS = 100

function tableError(message: string): Error {
  return new Error(`CG-1101 ${message}`)
}

function lastIndexWhere<T>(items: T[], predicate: (item: T) => boolean): number {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    if (predicate(items[index] as T)) return index
  }
  return -1
}

function trimToLimits(rows: TableCell[][]): TableCell[][] {
  if (rows.length > MAX_TABLE_ROWS + 1) {
    throw tableError(
      `the sheet has ${rows.length} rows; ClassGraph imports at most ${MAX_TABLE_ROWS} students at a time`,
    )
  }
  const widest = rows.reduce((max, row) => Math.max(max, row.length), 0)
  if (widest > MAX_TABLE_COLUMNS) {
    throw tableError(`the sheet has ${widest} columns; at most ${MAX_TABLE_COLUMNS} are supported`)
  }
  // Drop fully blank trailing rows and pad rows to the same width.
  const lastUsed = lastIndexWhere(rows, (row) => row.some((cell) => cell !== null))
  const kept = rows.slice(0, lastUsed + 1)
  const width = kept.reduce((max, row) => {
    const lastCell = lastIndexWhere(row, (cell) => cell !== null)
    return Math.max(max, lastCell + 1)
  }, 0)
  return kept.map((row) => Array.from({ length: width }, (_, index) => row[index] ?? null))
}

// ---------------------------------------------------------------------------------------------
// CSV

/** Decodes CSV bytes as UTF-8 when valid, otherwise as GB18030 (a superset of GBK/GB2312). */
export function decodeCsvBytes(bytes: Uint8Array): { text: string; encoding: 'utf-8' | 'gb18030' } {
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    return { text: text.replace(/^\uFEFF/, ''), encoding: 'utf-8' }
  } catch {
    return { text: new TextDecoder('gb18030').decode(bytes), encoding: 'gb18030' }
  }
}

function detectDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? ''
  const counts = [',', ';', '\t'].map((delimiter) => ({
    delimiter,
    count: firstLine.split(delimiter).length - 1,
  }))
  counts.sort((a, b) => b.count - a.count)
  return counts[0] && counts[0].count > 0 ? counts[0].delimiter : ','
}

/** RFC 4180 parser with quoted fields, doubled quotes, CRLF/LF and an auto-detected delimiter. */
export function parseCsv(text: string): TableCell[][] {
  const delimiter = detectDelimiter(text)
  const rows: TableCell[][] = []
  let row: TableCell[] = []
  let field = ''
  let quoted = false
  let fieldWasQuoted = false

  const endField = () => {
    const value = fieldWasQuoted ? field : field.trim()
    row.push(value === '' ? null : value)
    field = ''
    fieldWasQuoted = false
  }
  const endRow = () => {
    endField()
    rows.push(row)
    row = []
  }

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]
    if (quoted) {
      if (character === '"') {
        if (text[index + 1] === '"') {
          field += '"'
          index += 1
        } else {
          quoted = false
        }
      } else {
        field += character
      }
      continue
    }
    if (character === '"' && field.trim() === '') {
      quoted = true
      fieldWasQuoted = true
      field = ''
    } else if (character === delimiter) {
      endField()
    } else if (character === '\n') {
      endRow()
    } else if (character === '\r') {
      if (text[index + 1] !== '\n') endRow()
    } else {
      field += character
    }
  }
  if (quoted) throw tableError('the CSV file has an unclosed quoted field')
  if (field !== '' || fieldWasQuoted || row.length > 0) endRow()
  return rows
}

// ---------------------------------------------------------------------------------------------
// XLSX (Office Open XML spreadsheet). Only cell values are read; formulas use their cached value.

const XML_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
}

function decodeXml(value: string): string {
  return value.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-z]+);/g, (match, entity: string) => {
    if (entity.startsWith('#x')) return String.fromCodePoint(Number.parseInt(entity.slice(2), 16))
    if (entity.startsWith('#')) return String.fromCodePoint(Number.parseInt(entity.slice(1), 10))
    return XML_ENTITIES[entity] ?? match
  })
}

function attribute(tag: string, name: string): string | undefined {
  const match = new RegExp(`\\s${name}="([^"]*)"`).exec(tag)
  return match ? decodeXml(match[1] ?? '') : undefined
}

/** Concatenates every <t> text run inside an element (handles rich-text runs). */
function textRuns(xml: string): string {
  let text = ''
  for (const match of xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g))
    text += decodeXml(match[1] ?? '')
  return text
}

function columnIndex(reference: string): number {
  const letters = /^[A-Z]+/.exec(reference)?.[0] ?? 'A'
  let index = 0
  for (const letter of letters) index = index * 26 + (letter.charCodeAt(0) - 64)
  return index - 1
}

const BUILT_IN_DATE_FORMATS = new Set([14, 15, 16, 17, 22, 27, 30, 36, 50, 57, 58])

function isDateFormatCode(code: string): boolean {
  const cleaned = code.replace(/"[^"]*"|\[[^\]]*\]|\\./g, '')
  return /[ymd]/i.test(cleaned) && !/^[#0.,%\s]*$/.test(cleaned)
}

/** Returns, per style index, whether that cell style formats numbers as dates. */
function dateStyles(stylesXml: string | undefined): boolean[] {
  if (!stylesXml) return []
  const customDate = new Set<number>()
  for (const match of stylesXml.matchAll(/<numFmt\s[^>]*>/g)) {
    const id = Number(attribute(match[0], 'numFmtId'))
    const code = attribute(match[0], 'formatCode') ?? ''
    if (isDateFormatCode(code)) customDate.add(id)
  }
  const cellXfs = /<cellXfs[^>]*>([\s\S]*?)<\/cellXfs>/.exec(stylesXml)?.[1] ?? ''
  return [...cellXfs.matchAll(/<xf\s[^>]*?\/?>/g)].map((match) => {
    const id = Number(attribute(match[0], 'numFmtId') ?? '0')
    return BUILT_IN_DATE_FORMATS.has(id) || customDate.has(id)
  })
}

function excelSerialToIsoDate(serial: number): string {
  // Excel's 1900 date system (with its 1900 leap-year bug): serial 25569 is 1970-01-01.
  const milliseconds = Math.round((serial - 25569) * 86400 * 1000)
  return new Date(milliseconds).toISOString().slice(0, 10)
}

function parseSheetXml(xml: string, sharedStrings: string[], dates: boolean[]): TableCell[][] {
  const rows: TableCell[][] = []
  for (const rowMatch of xml.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>|<row\b([^>]*)\/>/g)) {
    const rowAttributes = rowMatch[1] ?? rowMatch[3] ?? ''
    const rowNumber = Number(attribute(` ${rowAttributes}`, 'r') ?? rows.length + 1)
    const cells: TableCell[] = []
    const body = rowMatch[2] ?? ''
    for (const cellMatch of body.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const tag = ` ${cellMatch[1] ?? ''}`
      const inner = cellMatch[2] ?? ''
      const reference = attribute(tag, 'r')
      const index = reference ? columnIndex(reference) : cells.length
      const type = attribute(tag, 't') ?? 'n'
      const raw = /<v>([\s\S]*?)<\/v>/.exec(inner)?.[1]
      let value: TableCell = null
      if (type === 'inlineStr') value = textRuns(inner)
      else if (raw === undefined) value = null
      else if (type === 's') value = sharedStrings[Number(raw)] ?? null
      else if (type === 'b') value = raw === '1'
      else if (type === 'str' || type === 'e') value = decodeXml(raw)
      else {
        const number = Number(raw)
        const style = Number(attribute(tag, 's') ?? '0')
        value = Number.isFinite(number)
          ? dates[style]
            ? excelSerialToIsoDate(number)
            : number
          : decodeXml(raw)
      }
      if (typeof value === 'string' && value.trim() === '') value = null
      cells[index] = typeof value === 'string' ? value.trim() : value
    }
    rows[rowNumber - 1] = Array.from(cells, (cell) => cell ?? null)
  }
  return Array.from(rows, (row) => row ?? [])
}

async function zipText(zip: JSZip, path: string): Promise<string | undefined> {
  return zip.file(path)?.async('string')
}

export async function parseXlsx(bytes: Uint8Array): Promise<TableSheet[]> {
  let zip: JSZip
  try {
    zip = await JSZip.loadAsync(bytes)
  } catch {
    throw tableError('the file is not a readable .xlsx workbook')
  }
  const workbook = await zipText(zip, 'xl/workbook.xml')
  if (!workbook) throw tableError('the file is not a readable .xlsx workbook')

  const relationships = (await zipText(zip, 'xl/_rels/workbook.xml.rels')) ?? ''
  const targets = new Map<string, string>()
  for (const match of relationships.matchAll(/<Relationship\s[^>]*>/g)) {
    const id = attribute(match[0], 'Id')
    const target = attribute(match[0], 'Target')
    if (id && target) {
      targets.set(
        id,
        target.startsWith('/') ? target.slice(1) : `xl/${target.replace(/^\.\//, '')}`,
      )
    }
  }

  const sharedXml = (await zipText(zip, 'xl/sharedStrings.xml')) ?? ''
  const sharedStrings = [...sharedXml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((match) =>
    textRuns(match[1] ?? ''),
  )
  const dates = dateStyles(await zipText(zip, 'xl/styles.xml'))

  const sheets: TableSheet[] = []
  for (const match of workbook.matchAll(/<sheet\s[^>]*>/g)) {
    const name = attribute(match[0], 'name') ?? `Sheet ${sheets.length + 1}`
    const relationId = attribute(match[0], 'r:id')
    const path = relationId ? targets.get(relationId) : undefined
    const xml = path ? await zipText(zip, path) : undefined
    if (!xml) continue
    sheets.push({ name, rows: trimToLimits(parseSheetXml(xml, sharedStrings, dates)) })
  }
  if (sheets.length === 0) throw tableError('the workbook has no readable sheets')
  return sheets
}

// ---------------------------------------------------------------------------------------------

export async function readTableFile(fileName: string, bytes: Uint8Array): Promise<ReadTable> {
  const lower = fileName.toLowerCase()
  if (lower.endsWith('.xls')) {
    throw tableError(
      'old .xls workbooks are not supported; in Excel or WPS choose Save As and pick .xlsx or CSV',
    )
  }
  const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b
  if (lower.endsWith('.xlsx') || isZip) {
    return { format: 'xlsx', sheets: await parseXlsx(bytes) }
  }
  const { text, encoding } = decodeCsvBytes(bytes)
  return {
    format: 'csv',
    encoding,
    sheets: [
      { name: fileName.replace(/\.[^.]+$/, '') || 'Sheet 1', rows: trimToLimits(parseCsv(text)) },
    ],
  }
}
