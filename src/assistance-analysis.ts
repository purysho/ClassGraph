import type { AnalysisExplanationProposal } from './assistance-contract.js'
import type { ProjectAnalysisView } from './analysis-view.js'

function numberText(value: number | null): string {
  if (value === null) return 'not available'
  return new Intl.NumberFormat('en', { maximumFractionDigits: 2 }).format(value)
}

export function draftAnalysisExplanation(
  analysis: ProjectAnalysisView,
  requestId: string,
  providerLabel?: string,
): AnalysisExplanationProposal {
  const lines = [
    `The current analysis covers ${analysis.studentCount} student(s) and ${analysis.metricCount} defined metric(s).`,
    `Across ${analysis.completeness.totalCells} possible metric cells, ${analysis.completeness.recordedCount} are recorded, ${analysis.completeness.explicitMissingCount} are explicitly missing, and ${analysis.completeness.unrecordedCount} are not recorded.`,
  ]

  for (const metric of analysis.metrics) {
    if (metric.kind === 'number') {
      lines.push(
        `${metric.label}: ${metric.summary.recordedCount} recorded value(s), ${metric.summary.missingCount} missing/unrecorded value(s), range ${numberText(metric.summary.min)} to ${numberText(metric.summary.max)}, median ${numberText(metric.summary.median)}, mean ${numberText(metric.summary.mean)}.`,
      )
    } else {
      const counts = Object.entries(metric.summary.counts)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([value, count]) => `${value}: ${count}`)
        .join(', ')
      lines.push(
        `${metric.label}: ${metric.summary.recordedCount} recorded value(s), ${metric.summary.missingCount} missing/unrecorded value(s)${counts ? `; recorded counts are ${counts}` : ''}.`,
      )
    }
  }

  const caveats = [
    'These statements describe the values currently recorded in ClassGraph; they do not diagnose students or predict future attainment.',
    'Patterns, differences, or associations in descriptive data do not establish causation.',
  ]
  if (analysis.completeness.explicitMissingCount > 0 || analysis.completeness.unrecordedCount > 0) {
    caveats.unshift(
      'Missing and not-recorded values are not imputed; they are excluded from metric summaries.',
    )
  }

  return {
    version: '1.0',
    proposalId: `proposal-${requestId}`,
    requestId,
    task: 'analysis-explanation',
    status: 'proposal',
    ...(providerLabel ? { providerLabel } : {}),
    warnings: [],
    assumptions: [],
    text: lines.join('\n\n'),
    sourceMetricKeys: analysis.metrics.map((metric) => metric.key),
    caveats,
  }
}
