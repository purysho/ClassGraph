import { describe, expect, it } from 'vitest'
import type { AnalysisExportV1 } from '../src/export-json.js'
import {
  buildSeatingPlanExport,
  safeExportStem,
  serializeAnalysisExport,
  serializeSeatingPlanExport,
} from '../src/export-json.js'
import { buildReportSnapshot } from '../src/report-model.js'
import type { ClassGraphProject } from '../src/model.js'

function fixture(): ClassGraphProject {
  return {
    schemaVersion: '1.0',
    projectId: 'phase-3-fixture',
    title: 'Grade 5 / 英语: A*',
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
        { id: 'seat-r1-c1', row: 0, column: 0, enabled: true, tags: ['front'] },
        { id: 'seat-r1-c2', row: 0, column: 1, enabled: true },
      ],
    },
    planning: {
      ruleSchemaVersion: '1.0',
      seed: 'approved-seed',
      assignments: [{ studentId: 's1', seatId: 'seat-r1-c1', locked: true }],
      rules: [
        {
          id: 'front',
          strength: 'hard',
          kind: 'seat-tag-required',
          studentId: 's1',
          tag: 'front',
        },
      ],
      groups: [{ id: 'g1', label: 'Group 1', studentIds: ['s1'], lockedStudentIds: ['s1'] }],
    },
    provenance: {
      '/students/0/displayName': { kind: 'imported', source: 'fixture' },
      '/students/0/metrics/score': { kind: 'synthetic', source: 'fixture' },
      '/students/0/metrics/flag': { kind: 'teacher-entered' },
      '/room': { kind: 'teacher-entered', source: 'manual-room-grid' },
      '/planning/assignments/0': {
        kind: 'teacher-entered',
        source: 'accepted-seating-candidate',
      },
    },
  }
}

describe('Phase 3 portable exports', () => {
  it('builds a deterministic report snapshot without imputing missing values', () => {
    const first = buildReportSnapshot(fixture())
    const second = buildReportSnapshot(fixture())

    expect(first).toEqual(second)
    expect(first.analysis.completeness).toEqual({
      totalCells: 4,
      recordedCount: 2,
      explicitMissingCount: 1,
      unrecordedCount: 1,
    })
    expect(first.syntheticPaths).toEqual(['/students/0/metrics/score'])
    expect(first.limitations.some((item) => item.includes('not recorded'))).toBe(true)
    expect(first.limitations.some((item) => item.includes('not imputed'))).toBe(true)
  })

  it('serializes analysis JSON byte-for-byte deterministically', () => {
    const first = serializeAnalysisExport(fixture())
    const second = serializeAnalysisExport(fixture())

    expect(first).toBe(second)
    const parsed = JSON.parse(first) as AnalysisExportV1
    expect(parsed.format).toBe('classgraph-analysis')
    expect(parsed.version).toBe('1.0')
    expect(parsed.analysis.studentCount).toBe(2)
    expect(parsed.syntheticPaths).toEqual(['/students/0/metrics/score'])
  })

  it('exports only persisted planning state, never transient candidate state', () => {
    const exported = buildSeatingPlanExport(fixture())

    expect(exported.approvedPlanning.assignments).toEqual([
      { studentId: 's1', seatId: 'seat-r1-c1', locked: true },
    ])
    expect(exported.approvedPlanning.rules).toHaveLength(1)
    expect(exported.approvedPlanning.groups).toHaveLength(1)
    expect(exported.planningProvenance['/planning/assignments/0']?.kind).toBe('teacher-entered')
    expect(JSON.stringify(exported)).not.toContain('seat-candidate-')
  })

  it('serializes the seating plan deterministically', () => {
    expect(serializeSeatingPlanExport(fixture())).toBe(serializeSeatingPlanExport(fixture()))
  })

  it('creates safe cross-platform export filename stems while preserving Unicode', () => {
    expect(safeExportStem('Grade 5 / 英语: A*')).toBe('Grade 5 - 英语- A-')
    expect(safeExportStem('../secret\\report')).toBe('secret-report')
    expect(safeExportStem('CON')).toBe('classgraph-CON')
    expect(safeExportStem('   ')).toBe('classgraph')
    expect([...safeExportStem('x'.repeat(120))]).toHaveLength(80)
  })
})
