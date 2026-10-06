import fontkit from '@pdf-lib/fontkit'
import { readFileSync } from 'node:fs'
import { createPdfDocument, loadPdfDocument } from '../src/pdf-runtime.js'
import { embedReportFonts } from '../src/pdf-fonts.js'
import { describe, expect, it } from 'vitest'
import { ClassGraphExportError } from '../src/export-errors.js'
import { generatePdfReport, generateSeatingPlanPdf } from '../src/report-pdf.js'
import type { ClassGraphProject } from '../src/model.js'

function fixture(title = 'Grade 5 English'): ClassGraphProject {
  return {
    schemaVersion: '1.0',
    projectId: 'pdf-fixture',
    title,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T01:00:00.000Z',
    classInfo: { subject: 'English' },
    metricDefinitions: [{ key: 'score', label: 'Score', kind: 'number' }],
    students: [
      { id: 's1', displayName: 'Student One', metrics: { score: 80 } },
      { id: 's2', metrics: { score: null } },
    ],
    room: {
      layout: 'grid',
      rows: 2,
      columns: 2,
      front: 'top',
      seats: [
        { id: 'seat-r1-c1', row: 0, column: 0, enabled: true, tags: ['front'] },
        { id: 'seat-r1-c2', row: 0, column: 1, enabled: true },
        { id: 'seat-r2-c1', row: 1, column: 0, enabled: false },
        { id: 'seat-r2-c2', row: 1, column: 1, enabled: true },
      ],
    },
    planning: {
      assignments: [{ studentId: 's1', seatId: 'seat-r1-c1', locked: true }],
      rules: [],
      groups: [],
    },
    provenance: {
      '/students/0/metrics/score': { kind: 'teacher-entered' },
      '/planning/assignments/0': { kind: 'teacher-entered' },
    },
  }
}

describe('PDF exports', () => {
  it('creates a readable multi-section PDF report for WinAnsi-safe content', async () => {
    const bytes = await generatePdfReport(fixture())
    expect(new TextDecoder('latin1').decode(bytes.slice(0, 5))).toBe('%PDF-')

    const loaded = await loadPdfDocument(bytes)
    expect(loaded.getPageCount()).toBeGreaterThan(0)
    const first = loaded.getPage(0)
    expect(first.getWidth()).toBeLessThan(first.getHeight())
  })

  it('creates a landscape seating plan with a table fallback page', async () => {
    const bytes = await generateSeatingPlanPdf(fixture())
    const loaded = await loadPdfDocument(bytes)

    expect(loaded.getPageCount()).toBeGreaterThanOrEqual(2)
    const first = loaded.getPage(0)
    expect(first.getWidth()).toBeGreaterThan(first.getHeight())
    for (const page of loaded.getPages()) {
      expect(page.getWidth()).toBeGreaterThan(page.getHeight())
    }
  })

  it('exports Chinese titles and names in both PDF reports', async () => {
    const project = fixture('Grade 5 英语')
    project.students[0] = { ...project.students[0]!, displayName: '张喆' }
    project.room!.seats[0] = { ...project.room!.seats[0]!, tags: ['前排'] }

    const report = await generatePdfReport(project)
    const seating = await generateSeatingPlanPdf(project)
    expect((await loadPdfDocument(report)).getPageCount()).toBeGreaterThan(0)
    expect((await loadPdfDocument(seating)).getPageCount()).toBeGreaterThanOrEqual(2)
    // Only the glyphs used are embedded, not the whole 7 MB font.
    expect(report.byteLength).toBeLessThan(150_000)
    expect(seating.byteLength).toBeLessThan(150_000)
  })

  it('fails clearly, naming the character, rather than dropping it', async () => {
    const project = fixture('Grade 5 英语 😀')
    await expect(generatePdfReport(project)).rejects.toMatchObject({ code: 'CG-5004' })
    await expect(generateSeatingPlanPdf(project)).rejects.toThrow('😀')
  })

  it('requires a grid room for seating-plan PDF export', async () => {
    const project = fixture()
    delete project.room
    project.planning = { assignments: [], rules: [], groups: [] }

    try {
      await generateSeatingPlanPdf(project)
      throw new Error('expected export to fail')
    } catch (error) {
      expect(error).toBeInstanceOf(ClassGraphExportError)
      expect((error as ClassGraphExportError).code).toBe('CG-5002')
    }
  })

  it('does not mutate the project while generating PDFs', async () => {
    const project = fixture()
    const before = structuredClone(project)
    await generatePdfReport(project)
    await generateSeatingPlanPdf(project)
    expect(project).toEqual(before)
  })
})

describe('PDF font selection', () => {
  it('keeps the built-in Latin fonts for text they can encode', async () => {
    const fonts = await embedReportFonts(await createPdfDocument(), [
      'Grade 5 English',
      'Zoë – café',
    ])
    expect(fonts.unicode).toBe(false)
    expect(fonts.bold.syntheticBold).toBe(false)
  })

  it('switches to the bundled CJK font and simulates bold with one weight', async () => {
    const fonts = await embedReportFonts(await createPdfDocument(), ['学生甲', 'Grade 5'])
    expect(fonts.unicode).toBe(true)
    expect(fonts.bold.syntheticBold).toBe(true)
    expect(fonts.regular.missingCharacters('张喆 玥 淏 English')).toEqual([])
  })

  it('reports every character neither font can draw', async () => {
    await expect(
      embedReportFonts(await createPdfDocument(), ['学生甲', '\u4dae', '안녕']),
    ).rejects.toThrow(/\u4dae.*안/u)
  })

  it('ships a font whose glyphs survive pdf-lib subsetting', () => {
    // fontkit writes a short-format loca table when subsetting, which needs even glyph offsets.
    const font = fontkit.create(
      readFileSync('assets/fonts/NotoSansSC-Regular-ClassGraph.ttf'),
    ) as unknown as { loca: { offsets: number[] } }
    expect(font.loca.offsets.every((offset) => offset % 2 === 0)).toBe(true)
  })
})
