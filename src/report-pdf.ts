import {
  createPdfDocument,
  pdfRgb,
  type PdfDocumentAdapter,
  type PdfPageAdapter,
} from './pdf-runtime.js'
import { ClassGraphExportError } from './export-errors.js'
import type { ClassGraphProject, PlanningSeatAssignment, SeatDefinition } from './model.js'
import { assertRenderable, drawReportText, embedReportFonts, type ReportFont } from './pdf-fonts.js'
import { buildHumanReport, type HumanReport, type HumanReportTable } from './report-content.js'
import { classGraphProjectSchema } from './schema.js'

const A4_PORTRAIT: [number, number] = [595.28, 841.89]
const A4_LANDSCAPE: [number, number] = [841.89, 595.28]
const MARGIN = 42

function widthOf(font: ReportFont, text: string, size: number): number {
  return font.pdf.widthOfTextAtSize(text, size)
}

/** Splits a single unbreakable token (for example a run of Chinese characters) to fit `width`. */
function breakToken(font: ReportFont, token: string, size: number, width: number): string[] {
  const pieces: string[] = []
  let current = ''
  for (const character of token) {
    const candidate = current + character
    if (current && widthOf(font, candidate, size) > width) {
      pieces.push(current)
      current = character
    } else {
      current = candidate
    }
  }
  if (current) pieces.push(current)
  return pieces
}

function wrapText(font: ReportFont, text: string, size: number, width: number): string[] {
  assertRenderable(font, text)
  const words = text
    .split(/\s+/)
    .filter(Boolean)
    .flatMap((word) =>
      widthOf(font, word, size) > width ? breakToken(font, word, size, width) : [word],
    )
  if (words.length === 0) return ['']

  const lines: string[] = []
  let current = ''

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (widthOf(font, candidate, size) <= width || !current) {
      current = candidate
      continue
    }
    lines.push(current)
    current = word
  }
  if (current) lines.push(current)
  return lines
}

/** Clips `text` with an ellipsis so it fits `width` at `size`. */
function fitToWidth(font: ReportFont, text: string, size: number, width: number): string {
  if (widthOf(font, text, size) <= width) return text
  const characters = [...text]
  while (characters.length > 0 && widthOf(font, `${characters.join('')}…`, size) > width) {
    characters.pop()
  }
  return `${characters.join('')}…`
}

interface PdfCursor {
  document: PdfDocumentAdapter
  page: PdfPageAdapter
  regular: ReportFont
  bold: ReportFont
  y: number
  pageWidth: number
  pageHeight: number
}

function newPortraitPage(
  document: PdfDocumentAdapter,
  regular: ReportFont,
  bold: ReportFont,
): PdfCursor {
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
    drawReportText(next.page, line, font, {
      x: MARGIN + indent,
      y: next.y - size,
      size,
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

function reportTexts(report: HumanReport): string[] {
  return [
    report.title,
    report.subtitle,
    ...report.sections.flatMap((section) => [
      section.title,
      ...section.paragraphs,
      ...section.tables.flatMap((table) => [
        table.title ?? '',
        ...table.headers,
        ...table.rows.flat(),
      ]),
    ]),
  ]
}

export async function generatePdfReport(project: ClassGraphProject): Promise<Uint8Array> {
  const validated = classGraphProjectSchema.parse(project)
  const report = buildHumanReport(validated)
  const document = await createPdfDocument()
  const { regular, bold } = await embedReportFonts(document, reportTexts(report))
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
  font: ReportFont,
  bold: ReportFont,
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
    const lineFont = index === 1 ? bold : font
    const clipped = fitToWidth(lineFont, lines[index] ?? '', size, width - 8)
    drawReportText(page, clipped, lineFont, {
      x: x + 4,
      y: textY,
      size,
      color: pdfRgb(0.14, 0.18, 0.2),
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
  const { regular, bold } = await embedReportFonts(document, [
    validated.title,
    validated.room.front ?? '',
    ...validated.students.flatMap((student) => [student.id, student.displayName ?? '']),
    ...validated.room.seats.flatMap((seat) => [seat.id, ...(seat.tags ?? [])]),
  ])
  const assignments = validated.planning?.assignments ?? []
  const assignmentMap = seatAssignmentMap(assignments)

  const usableWidth = A4_LANDSCAPE[0] - MARGIN * 2
  const usableHeight = A4_LANDSCAPE[1] - MARGIN * 2 - 52
  const columnsPerPage = Math.max(1, Math.min(columns, Math.floor(usableWidth / 72)))
  const rowsPerPage = Math.max(1, Math.min(rows, Math.floor(usableHeight / 56)))

  for (let rowStart = 0; rowStart < rows; rowStart += rowsPerPage) {
    for (let columnStart = 0; columnStart < columns; columnStart += columnsPerPage) {
      const page = document.addPage(A4_LANDSCAPE)
      drawReportText(
        page,
        fitToWidth(bold, validated.title, 15, A4_LANDSCAPE[0] - MARGIN * 2),
        bold,
        { x: MARGIN, y: A4_LANDSCAPE[1] - MARGIN + 5, size: 15 },
      )

      const marker = `Front of room: ${validated.room.front ?? 'not specified'} · Rows ${rowStart + 1}-${Math.min(rows, rowStart + rowsPerPage)} · Columns ${columnStart + 1}-${Math.min(columns, columnStart + columnsPerPage)}`
      drawReportText(page, marker, regular, {
        x: MARGIN,
        y: A4_LANDSCAPE[1] - MARGIN - 15,
        size: 9,
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
  drawReportText(page, 'Assignment table', bold, { x: MARGIN, y, size: 14 })
  y -= 22

  for (const student of validated.students) {
    const assignment = assignments.find((item) => item.studentId === student.id)
    const row = `${studentLabel(validated, student.id)} | ${assignment?.seatId ?? 'Unassigned'} | ${assignment?.locked ? 'Locked' : 'Unlocked'}`
    if (y < MARGIN + 12) {
      page = document.addPage(A4_LANDSCAPE)
      y = A4_LANDSCAPE[1] - MARGIN
      drawReportText(page, 'Assignment table (continued)', bold, { x: MARGIN, y, size: 14 })
      y -= 22
    }
    drawReportText(page, fitToWidth(regular, row, 9, A4_LANDSCAPE[0] - MARGIN * 2), regular, {
      x: MARGIN,
      y,
      size: 9,
    })
    y -= 13
  }

  return document.save()
}
