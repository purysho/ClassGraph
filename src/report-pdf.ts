import {
  createPdfDocument,
  pdfRgb,
  pdfStandardFonts,
  type PdfDocumentAdapter,
  type PdfFontAdapter,
  type PdfPageAdapter,
} from './pdf-runtime.js'
import { ClassGraphExportError } from './export-errors.js'
import type { ClassGraphProject, PlanningSeatAssignment, SeatDefinition } from './model.js'
import { buildHumanReport, type HumanReportTable } from './report-content.js'
import { classGraphProjectSchema } from './schema.js'

const A4_PORTRAIT: [number, number] = [595.28, 841.89]
const A4_LANDSCAPE: [number, number] = [841.89, 595.28]
const MARGIN = 42

function exportUnicodeError(): ClassGraphExportError {
  return new ClassGraphExportError(
    'CG-5004',
    'This PDF contains characters that the built-in PDF font cannot encode. Use DOCX export for full Unicode text or configure a local embedded Unicode font in a future packaged build.',
  )
}

function ensureEncodable(font: PdfFontAdapter, text: string): void {
  try {
    font.encodeText(text)
  } catch {
    throw exportUnicodeError()
  }
}

function wrapText(font: PdfFontAdapter, text: string, size: number, width: number): string[] {
  ensureEncodable(font, text)
  const words = text.split(/\s+/).filter(Boolean)
  if (words.length === 0) return ['']

  const lines: string[] = []
  let current = ''

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (font.widthOfTextAtSize(candidate, size) <= width || !current) {
      current = candidate
      continue
    }
    lines.push(current)
    current = word
  }
  if (current) lines.push(current)
  return lines
}

interface PdfCursor {
  document: PdfDocumentAdapter
  page: PdfPageAdapter
  regular: PdfFontAdapter
  bold: PdfFontAdapter
  y: number
  pageWidth: number
  pageHeight: number
}

function newPortraitPage(document: PdfDocumentAdapter, regular: PdfFontAdapter, bold: PdfFontAdapter): PdfCursor {
  const page = document.addPage(A4_PORTRAIT)
  return {
    document,
    page,
    regular,
    bold,
    y: A4_PORTRAIT[1] - MARGIN,
    pageWidth: A4_PORTRAIT[0],
    pageHeight: A4_PORTRAIT[1],
  }
}

function ensureRoom(cursor: PdfCursor, requiredHeight: number): PdfCursor {
  if (cursor.y - requiredHeight >= MARGIN) return cursor
  return newPortraitPage(cursor.document, cursor.regular, cursor.bold)
}

function drawWrapped(
  cursor: PdfCursor,
  text: string,
  options: { size?: number; bold?: boolean; indent?: number; spacingAfter?: number } = {},
): PdfCursor {
  const size = options.size ?? 10
  const font = options.bold ? cursor.bold : cursor.regular
  const indent = options.indent ?? 0
  const lineHeight = size * 1.35
  const width = cursor.pageWidth - MARGIN * 2 - indent
  const lines = wrapText(font, text, size, width)
  const next = ensureRoom(cursor, lines.length * lineHeight + (options.spacingAfter ?? 4))

  for (const line of lines) {
    next.page.drawText(line, {
      x: MARGIN + indent,
      y: next.y - size,
      size,
      font,
      color: pdfRgb(0.12, 0.16, 0.18),
    })
    next.y -= lineHeight
  }
  next.y -= options.spacingAfter ?? 4
  return next
}

function tableRows(table: HumanReportTable): string[] {
  const rows = [table.headers, ...table.rows]
  return rows.map((row) => row.join(' | '))
}

function drawTable(cursor: PdfCursor, table: HumanReportTable): PdfCursor {
  let next = cursor
  if (table.title) next = drawWrapped(next, table.title, { bold: true, size: 10 })
  const rows = tableRows(table)
  for (let index = 0; index < rows.length; index += 1) {
    next = drawWrapped(next, rows[index] ?? '', {
      size: index === 0 ? 8.5 : 8,
      bold: index === 0,
      indent: 8,
      spacingAfter: 2,
    })
  }
  next.y -= 5
  return next
}

export async function generatePdfReport(project: ClassGraphProject): Promise<Uint8Array> {
  const validated = classGraphProjectSchema.parse(project)
  const report = buildHumanReport(validated)
  const document = await createPdfDocument()
  const regular = await document.embedFont(pdfStandardFonts.Helvetica)
  const bold = await document.embedFont(pdfStandardFonts.HelveticaBold)
  let cursor = newPortraitPage(document, regular, bold)

  cursor = drawWrapped(cursor, report.title, { bold: true, size: 19, spacingAfter: 5 })
  cursor = drawWrapped(cursor, report.subtitle, { size: 11, spacingAfter: 14 })

  for (const section of report.sections) {
    cursor = drawWrapped(cursor, section.title, { bold: true, size: 14, spacingAfter: 6 })
    for (const paragraph of section.paragraphs) cursor = drawWrapped(cursor, paragraph)
    for (const table of section.tables) cursor = drawTable(cursor, table)
    cursor.y -= 8
  }

  return document.save()
}

function seatAssignmentMap(
  assignments: PlanningSeatAssignment[],
): Map<string, PlanningSeatAssignment> {
  return new Map(assignments.map((assignment) => [assignment.seatId, assignment]))
}

function studentLabel(project: ClassGraphProject, studentId: string): string {
  const student = project.students.find((item) => item.id === studentId)
  return student?.displayName ?? studentId
}

function seatByGridPosition(
  seats: SeatDefinition[],
  row: number,
  column: number,
): SeatDefinition | undefined {
  return seats.find((seat) => seat.row === row && seat.column === column)
}

function drawSeatCell(
  page: PdfPageAdapter,
  font: PdfFontAdapter,
  bold: PdfFontAdapter,
  project: ClassGraphProject,
  seat: SeatDefinition | undefined,
  assignmentMap: Map<string, PlanningSeatAssignment>,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  page.drawRectangle({
    x,
    y,
    width,
    height,
    borderWidth: 0.7,
    borderColor: pdfRgb(0.55, 0.6, 0.63),
    color: seat?.enabled === false ? pdfRgb(0.92, 0.92, 0.92) : pdfRgb(0.98, 0.99, 0.99),
  })
  if (!seat) return

  const assignment = assignmentMap.get(seat.id)
  const label = assignment ? studentLabel(project, assignment.studentId) : 'Empty'
  const tags = seat.tags?.join(', ') ?? ''
  const lines = [
    seat.id,
    seat.enabled ? label : 'Disabled',
    assignment?.locked ? 'Locked' : '',
    tags,
  ].filter(Boolean)

  const size = Math.max(5.5, Math.min(8, width / 12))
  let textY = y + height - size - 5
  for (let index = 0; index < lines.length; index += 1) {
    const value = lines[index] ?? ''
    ensureEncodable(font, value)
    const clipped = value.length > 28 ? `${value.slice(0, 27)}…` : value
    ensureEncodable(font, clipped)
    page.drawText(clipped, {
      x: x + 4,
      y: textY,
      size,
      font: index === 1 ? bold : font,
      color: pdfRgb(0.14, 0.18, 0.2),
      maxWidth: width - 8,
    })
    textY -= size + 2
    if (textY < y + 3) break
  }
}

export async function generateSeatingPlanPdf(project: ClassGraphProject): Promise<Uint8Array> {
  const validated = classGraphProjectSchema.parse(project)
  if (!validated.room || validated.room.layout !== 'grid') {
    throw new ClassGraphExportError(
      'CG-5002',
      'A grid room is required before exporting the landscape seating plan PDF.',
    )
  }

  const rows = validated.room.rows ?? 0
  const columns = validated.room.columns ?? 0
  if (rows < 1 || columns < 1) {
    throw new ClassGraphExportError('CG-5003', 'The grid room has invalid dimensions.')
  }

  const document = await createPdfDocument()
  const regular = await document.embedFont(pdfStandardFonts.Helvetica)
  const bold = await document.embedFont(pdfStandardFonts.HelveticaBold)
  const assignments = validated.planning?.assignments ?? []
  const assignmentMap = seatAssignmentMap(assignments)

  const usableWidth = A4_LANDSCAPE[0] - MARGIN * 2
  const usableHeight = A4_LANDSCAPE[1] - MARGIN * 2 - 52
  const columnsPerPage = Math.max(1, Math.min(columns, Math.floor(usableWidth / 72)))
  const rowsPerPage = Math.max(1, Math.min(rows, Math.floor(usableHeight / 56)))

  for (let rowStart = 0; rowStart < rows; rowStart += rowsPerPage) {
    for (let columnStart = 0; columnStart < columns; columnStart += columnsPerPage) {
      const page = document.addPage(A4_LANDSCAPE)
      ensureEncodable(bold, validated.title)
      page.drawText(validated.title, {
        x: MARGIN,
        y: A4_LANDSCAPE[1] - MARGIN + 5,
        size: 15,
        font: bold,
      })

      const marker = `Front of room: ${validated.room.front ?? 'not specified'} · Rows ${rowStart + 1}-${Math.min(rows, rowStart + rowsPerPage)} · Columns ${columnStart + 1}-${Math.min(columns, columnStart + columnsPerPage)}`
      ensureEncodable(regular, marker)
      page.drawText(marker, {
        x: MARGIN,
        y: A4_LANDSCAPE[1] - MARGIN - 15,
        size: 9,
        font: regular,
      })

      const visibleColumns = Math.min(columnsPerPage, columns - columnStart)
      const visibleRows = Math.min(rowsPerPage, rows - rowStart)
      const cellWidth = usableWidth / visibleColumns
      const cellHeight = usableHeight / visibleRows

      for (let rowOffset = 0; rowOffset < visibleRows; rowOffset += 1) {
        for (let columnOffset = 0; columnOffset < visibleColumns; columnOffset += 1) {
          const row = rowStart + rowOffset
          const column = columnStart + columnOffset
          const seat = seatByGridPosition(validated.room.seats, row, column)
          const x = MARGIN + columnOffset * cellWidth
          const y = MARGIN + (visibleRows - rowOffset - 1) * cellHeight
          drawSeatCell(
            page,
            regular,
            bold,
            validated,
            seat,
            assignmentMap,
            x,
            y,
            cellWidth,
            cellHeight,
          )
        }
      }
    }
  }

  let page = document.addPage(A4_LANDSCAPE)
  let y = A4_LANDSCAPE[1] - MARGIN
  page.drawText('Assignment table', { x: MARGIN, y, size: 14, font: bold })
  y -= 22

  for (const student of validated.students) {
    const assignment = assignments.find((item) => item.studentId === student.id)
    const row = `${studentLabel(validated, student.id)} | ${assignment?.seatId ?? 'Unassigned'} | ${assignment?.locked ? 'Locked' : 'Unlocked'}`
    ensureEncodable(regular, row)
    if (y < MARGIN + 12) {
      page = document.addPage(A4_LANDSCAPE)
      y = A4_LANDSCAPE[1] - MARGIN
      page.drawText('Assignment table (continued)', { x: MARGIN, y, size: 14, font: bold })
      y -= 22
    }
    page.drawText(row, { x: MARGIN, y, size: 9, font: regular })
    y -= 13
  }

  return document.save()
}
