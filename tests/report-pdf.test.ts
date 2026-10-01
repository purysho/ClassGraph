import { loadPdfDocument } from '../src/pdf-runtime.js'
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

  it('fails clearly rather than corrupting unsupported Unicode', async () => {
    await expect(generatePdfReport(fixture('Grade 5 英语'))).rejects.toMatchObject({
      code: 'CG-5004',
    })
    await expect(generateSeatingPlanPdf(fixture('Grade 5 英语'))).rejects.toMatchObject({
      code: 'CG-5004',
    })
  })

  it('requires a grid room for seating-plan PDF export', async () => {
    const project = fixture()
    delete project.room

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
