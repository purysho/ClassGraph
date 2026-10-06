import { ASSOCIATION_CAVEAT } from './analysis-compare.js'
import type { ClassGraphProject, PlanningRule } from './model.js'
import type { ReportComparisonResult } from './report-comparisons.js'
import { buildReportSnapshot } from './report-model.js'
import { classGraphProjectSchema } from './schema.js'

export interface HumanReportTable {
  title?: string
  headers: string[]
  rows: string[][]
}

export interface HumanReportSection {
  title: string
  paragraphs: string[]
  tables: HumanReportTable[]
}

export interface HumanReport {
  title: string
  subtitle: string
  sections: HumanReportSection[]
}

function numberText(value: number | null): string {
  if (value === null) return '—'
  if (Number.isInteger(value)) return String(value)
  return value
    .toFixed(2)
    .replace(/\.00$/, '')
    .replace(/(\.\d)0$/, '$1')
}

function metricValueText(project: ClassGraphProject, studentId: string, metricKey: string): string {
  const student = project.students.find((item) => item.id === studentId)
  if (!student || !(metricKey in student.metrics)) return 'Not recorded'
  const value = student.metrics[metricKey]
  if (value === null) return 'Missing'
  if (typeof value === 'boolean') return value ? 'True' : 'False'
  return String(value)
}

function studentLabel(project: ClassGraphProject, studentId: string): string {
  const student = project.students.find((item) => item.id === studentId)
  return student?.displayName ? `${student.displayName} (${studentId})` : studentId
}

function ruleText(project: ClassGraphProject, rule: PlanningRule): string {
  switch (rule.kind) {
    case 'fixed-seat':
      return `${studentLabel(project, rule.studentId)} must use ${rule.seatId}.`
    case 'keep-apart':
      return `${studentLabel(project, rule.studentAId)} and ${studentLabel(project, rule.studentBId)} must not be ${rule.neighbourMode ?? 'orthogonal'} neighbours.`
    case 'seat-tag-required':
      return `${studentLabel(project, rule.studentId)} requires a seat tagged "${rule.tag}".`
    case 'prefer-together':
      return `Prefer ${studentLabel(project, rule.studentAId)} near ${studentLabel(project, rule.studentBId)} (weight ${rule.weight ?? 1}).`
    case 'prefer-apart':
      return `Prefer ${studentLabel(project, rule.studentAId)} away from ${studentLabel(project, rule.studentBId)} (weight ${rule.weight ?? 1}).`
    case 'prefer-seat-tag':
      return `Prefer ${studentLabel(project, rule.studentId)} in a seat tagged "${rule.tag}" (weight ${rule.weight ?? 1}).`
    case 'balance-metric-by-row':
      return `Balance recorded ${rule.metricKey} values across rows (weight ${rule.weight ?? 1}); unavailable values are ignored.`
  }
}

function metricSummaryTables(project: ClassGraphProject): HumanReportTable[] {
  const snapshot = buildReportSnapshot(project)
  const rows = snapshot.analysis.metrics.map((metric) => {
    if (metric.kind === 'number') {
      return [
        metric.label,
        'number',
        String(metric.summary.recordedCount),
        String(metric.summary.missingCount),
        numberText(metric.summary.min),
        numberText(metric.summary.max),
        numberText(metric.summary.mean),
        numberText(metric.summary.median),
      ]
    }

    const counts = Object.entries(metric.summary.counts)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([value, count]) => `${value}: ${count}`)
      .join('; ')

    return [
      metric.label,
      metric.sourceKind,
      String(metric.summary.recordedCount),
      String(metric.summary.missingCount),
      '—',
      '—',
      counts || '—',
      '—',
    ]
  })

  return [
    {
      title: 'Metric summaries',
      headers: [
        'Metric',
        'Kind',
        'Recorded',
        'Missing',
        'Min',
        'Max / Counts',
        'Mean / Counts',
        'Median',
      ],
      rows,
    },
  ]
}

function comparisonTable(result: ReportComparisonResult): HumanReportTable {
  if ('crossTab' in result) {
    const view = result.crossTab
    return {
      title: `Students by ${view.rowLabel} (rows) and ${view.columnLabel} (columns): ${view.bothRecordedCount} of ${view.studentCount} have both values recorded`,
      headers: [view.rowLabel, ...view.columns.map((level) => level.label), 'Total'],
      rows: [
        ...view.rows.map((level, r) => [
          level.label,
          ...view.columns.map((_, c) => String(view.counts[r]?.[c] ?? 0)),
          String(view.rowTotals[r] ?? 0),
        ]),
        ['Total', ...view.columnTotals.map(String), String(view.studentCount)],
      ],
    }
  }

  if ('association' in result) {
    const view = result.association
    const { association } = view
    const coefficient =
      association.coefficient === null
        ? association.unavailableReason === 'no-variation'
          ? 'Not shown: no variation in one metric'
          : 'Not shown: fewer than 3 students with both values'
        : association.coefficient.toFixed(2)
    const direction =
      association.direction === 'positive'
        ? 'Higher values tend to appear together'
        : association.direction === 'negative'
          ? 'Higher values of one appear with lower values of the other'
          : association.direction === 'none'
            ? 'No linear pattern'
            : '—'
    return {
      title: `Association between ${view.xLabel} and ${view.yLabel}`,
      headers: ['Pearson r', 'Students with both values', 'Students omitted', 'Pattern'],
      rows: [[coefficient, String(association.pairCount), String(view.omittedCount), direction]],
    }
  }

  const view = result.groupSummary
  const basis = view.basis === 'tag' ? 'student tag' : 'planning group'
  const title = `${view.metricLabel} by ${basis}${view.overlapping ? ' (students with several tags are counted in each)' : ''}`
  const segmentLabel = (segment: { label: string; studentCount: number }) =>
    `${segment.label} (${segment.studentCount})`

  if (view.metricKind === 'number') {
    return {
      title,
      headers: [
        'Segment (students)',
        'Recorded',
        'Missing',
        'Not recorded',
        'Min',
        'Median',
        'Mean',
        'Max',
      ],
      rows: view.segments.map((item) => [
        segmentLabel(item.segment),
        String(item.recordedCount),
        String(item.missingCount),
        String(item.notRecordedCount),
        numberText(item.min),
        numberText(item.median),
        numberText(item.mean),
        numberText(item.max),
      ]),
    }
  }

  return {
    title,
    headers: ['Segment (students)', ...view.levels.map((level) => level.label)],
    rows: view.segments.map((item) => [
      segmentLabel(item.segment),
      ...view.levels.map((_, index) => String(item.counts[index] ?? 0)),
    ]),
  }
}

function comparisonSection(comparisons: ReportComparisonResult[]): HumanReportSection[] {
  if (comparisons.length === 0) return []
  const hasAssociation = comparisons.some((result) => 'association' in result)
  return [
    {
      title: 'Selected comparisons',
      paragraphs: [
        'These comparisons were chosen by the teacher and are recalculated from the current data. Missing and Not recorded values are shown as their own rows, columns or counts and are never imputed.',
        ...(hasAssociation ? [ASSOCIATION_CAVEAT] : []),
        'Differences between rows, columns or segments describe the recorded data only; they are not explanations or predictions.',
      ],
      tables: comparisons.map(comparisonTable),
    },
  ]
}

function rosterTable(project: ClassGraphProject): HumanReportTable {
  return {
    title: 'Roster and recorded values',
    headers: ['Student ID', 'Name', ...project.metricDefinitions.map((metric) => metric.label)],
    rows: project.students.map((student) => [
      student.id,
      student.displayName ?? '—',
      ...project.metricDefinitions.map((metric) =>
        metricValueText(project, student.id, metric.key),
      ),
    ]),
  }
}

function seatingTable(project: ClassGraphProject): HumanReportTable {
  const assignments = new Map(
    (project.planning?.assignments ?? []).map((assignment) => [assignment.seatId, assignment]),
  )
  const seats = [...(project.room?.seats ?? [])].sort(
    (left, right) =>
      (left.row ?? 0) - (right.row ?? 0) ||
      (left.column ?? 0) - (right.column ?? 0) ||
      left.id.localeCompare(right.id),
  )

  return {
    title: 'Approved seating',
    headers: ['Seat', 'Position', 'Status', 'Student', 'Locked', 'Tags'],
    rows: seats.map((seat) => {
      const assignment = assignments.get(seat.id)
      return [
        seat.id,
        seat.row !== undefined && seat.column !== undefined
          ? `R${seat.row + 1} C${seat.column + 1}`
          : 'Custom',
        seat.enabled ? 'Enabled' : 'Disabled',
        assignment ? studentLabel(project, assignment.studentId) : '—',
        assignment?.locked ? 'Yes' : 'No',
        seat.tags?.join(', ') ?? '—',
      ]
    }),
  }
}

function groupsTable(project: ClassGraphProject): HumanReportTable {
  return {
    title: 'Approved groups',
    headers: ['Group', 'Students', 'Locked members'],
    rows: (project.planning?.groups ?? []).map((group) => [
      group.label ?? group.id,
      group.studentIds.map((id) => studentLabel(project, id)).join('; ') || '—',
      (group.lockedStudentIds ?? []).map((id) => studentLabel(project, id)).join('; ') || '—',
    ]),
  }
}

function rulesTable(project: ClassGraphProject): HumanReportTable {
  return {
    title: 'Planning rules',
    headers: ['Strength', 'Kind', 'Rule'],
    rows: (project.planning?.rules ?? []).map((rule) => [
      rule.strength,
      rule.kind,
      ruleText(project, rule),
    ]),
  }
}

export function buildHumanReport(input: ClassGraphProject): HumanReport {
  const project = classGraphProjectSchema.parse(input)
  const snapshot = buildReportSnapshot(project)
  const info = project.classInfo
  const provenance = snapshot.provenanceSummary

  const overview = [
    `${snapshot.analysis.studentCount} student(s); ${snapshot.analysis.metricCount} metric definition(s).`,
    [
      info.subject ? `Subject: ${info.subject}` : null,
      info.gradeOrLevel ? `Level: ${info.gradeOrLevel}` : null,
      info.term ? `Term: ${info.term}` : null,
      info.teacherLabel ? `Teacher label: ${info.teacherLabel}` : null,
    ]
      .filter((item): item is string => Boolean(item))
      .join(' · ') || 'No additional class metadata recorded.',
  ]

  const completeness = snapshot.analysis.completeness
  const provenanceParagraphs = [
    `Recorded metric cells: ${completeness.recordedCount}; explicitly missing: ${completeness.explicitMissingCount}; not recorded: ${completeness.unrecordedCount}.`,
    `Provenance entries — observed: ${provenance.observed}, teacher-entered: ${provenance['teacher-entered']}, imported: ${provenance.imported}, derived: ${provenance.derived}, synthetic: ${provenance.synthetic}.`,
  ]

  const planningParagraphs = [
    project.room
      ? `Room: ${project.room.layout}; front: ${project.room.front ?? 'not specified'}; enabled seats: ${project.room.seats.filter((seat) => seat.enabled).length}.`
      : 'No room definition is stored.',
    `Persisted seating assignments: ${project.planning?.assignments?.length ?? 0}; persisted groups: ${project.planning?.groups?.length ?? 0}; planning rules: ${project.planning?.rules?.length ?? 0}.`,
  ]

  return {
    title: project.title,
    subtitle: 'ClassGraph descriptive report',
    sections: [
      { title: 'Class overview', paragraphs: overview, tables: [] },
      { title: 'Data and provenance', paragraphs: provenanceParagraphs, tables: [] },
      {
        title: 'Metric summaries',
        paragraphs: [
          'Missing and not-recorded values are excluded from descriptive calculations; ClassGraph does not impute them.',
        ],
        tables: metricSummaryTables(project),
      },
      ...comparisonSection(snapshot.comparisons),
      { title: 'Roster values', paragraphs: [], tables: [rosterTable(project)] },
      {
        title: 'Approved seating and groups',
        paragraphs: planningParagraphs,
        tables: [seatingTable(project), groupsTable(project)],
      },
      {
        title: 'Planning rules',
        paragraphs: [
          'Hard constraints determine feasibility. Soft objectives express teacher-selected preferences and may trade off.',
        ],
        tables: [rulesTable(project)],
      },
      {
        title: 'Limitations and interpretation',
        paragraphs: snapshot.limitations,
        tables: [],
      },
    ],
  }
}
