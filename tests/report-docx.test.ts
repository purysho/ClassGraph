import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'
import { generateDocxReport } from '../src/report-docx.js'
import type { ClassGraphProject } from '../src/model.js'

function fixture(): ClassGraphProject {
  return {
    schemaVersion: '1.0',
    projectId: 'docx-fixture',
    title: 'Grade 5 英语',
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T01:00:00.000Z',
    classInfo: { subject: 'English', gradeOrLevel: 'Grade 5' },
    metricDefinitions: [
      { key: 'score', label: 'Score', kind: 'number' },
      { key: 'flag', label: 'Flag', kind: 'boolean' },
    ],
    students: [
      { id: 's1', displayName: '学生甲', metrics: { score: 80, flag: false } },
      { id: 's2', metrics: { score: null } },
    ],
    room: {
      layout: 'grid',
      rows: 1,
      columns: 2,
      front: 'top',
      seats: [
        { id: 'seat-r1-c1', row: 0, column: 0, enabled: true },
        { id: 'seat-r1-c2', row: 0, column: 1, enabled: true },
      ],
    },
    planning: {
      assignments: [{ studentId: 's1', seatId: 'seat-r1-c1', locked: true }],
      rules: [
        {
          id: 'front',
          strength: 'soft',
          kind: 'prefer-seat-tag',
          studentId: 's1',
          tag: 'front',
          weight: 1,
        },
      ],
      groups: [{ id: 'g1', studentIds: ['s1', 's2'] }],
    },
    provenance: {
      '/students/0/displayName': { kind: 'imported' },
      '/students/0/metrics/score': { kind: 'synthetic' },
      '/planning/assignments/0': { kind: 'teacher-entered' },
    },
  }
}

describe('DOCX report export', () => {
  it('creates a structurally valid OOXML package with expected report content', async () => {
    const bytes = await generateDocxReport(fixture())
    expect([...bytes.slice(0, 2)]).toEqual([0x50, 0x4b])

    const zip = await JSZip.loadAsync(bytes)
    expect(zip.file('[Content_Types].xml')).not.toBeNull()
    expect(zip.file('word/document.xml')).not.toBeNull()

    const xml = await zip.file('word/document.xml')!.async('string')
    expect(xml).toContain('Grade 5 英语')
    expect(xml).toContain('Class overview')
    expect(xml).toContain('Data and provenance')
    expect(xml).toContain('Metric summaries')
    expect(xml).toContain('Approved seating and groups')
    expect(xml).toContain('Limitations and interpretation')
    expect(xml).toContain('学生甲')
    expect(xml).toContain('Missing')
    expect(xml).toContain('Not recorded')
    expect(xml).toContain('False')
    expect(xml).not.toContain('improve learning by')
  })

  it('does not mutate the project while generating a report', async () => {
    const project = fixture()
    const before = structuredClone(project)
    await generateDocxReport(project)
    expect(project).toEqual(before)
  })
})
