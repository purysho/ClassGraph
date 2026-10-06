import {
  buildCrossTab,
  buildGroupSummary,
  type CrossTabView,
  type GroupSummaryView,
  type PearsonAssociation,
} from './analysis-compare.js'
import { buildScatterView } from './analysis-view.js'
import type { ClassGraphProject, ReportComparison } from './model.js'
import { classGraphProjectSchema, MAX_REPORT_COMPARISONS, reportComparisonId } from './schema.js'

/**
 * Teacher-selected comparisons that travel into DOCX/PDF reports and the analysis JSON export.
 * Only the selection is persisted; results are recomputed from the current project every time,
 * so a report can never carry a stale or edited figure.
 */

const SELECTION_PROVENANCE_PATH = '/reporting/comparisons'

export interface AssociationComparisonResult {
  xMetricKey: string
  yMetricKey: string
  xLabel: string
  yLabel: string
  omittedCount: number
  association: PearsonAssociation
}

export type ReportComparisonResult =
  | { id: string; selection: ReportComparison & { kind: 'crosstab' }; crossTab: CrossTabView }
  | {
      id: string
      selection: ReportComparison & { kind: 'association' }
      association: AssociationComparisonResult
    }
  | {
      id: string
      selection: ReportComparison & { kind: 'group-summary' }
      groupSummary: GroupSummaryView
    }

function withSelections(
  project: ClassGraphProject,
  comparisons: ReportComparison[],
  now: string,
): ClassGraphProject {
  const next = structuredClone(project)
  if (comparisons.length > 0) {
    next.reporting = { ...next.reporting, comparisons }
    next.provenance[SELECTION_PROVENANCE_PATH] = {
      kind: 'teacher-entered',
      source: 'report-comparison-selection',
    }
  } else {
    if (next.reporting) {
      delete next.reporting.comparisons
      if (Object.keys(next.reporting).length === 0) delete next.reporting
    }
    delete next.provenance[SELECTION_PROVENANCE_PATH]
  }
  next.updatedAt = now
  return classGraphProjectSchema.parse(next)
}

export function addReportComparison(
  project: ClassGraphProject,
  comparison: ReportComparison,
  now: string,
): ClassGraphProject {
  const existing = project.reporting?.comparisons ?? []
  const id = reportComparisonId(comparison)
  if (existing.some((item) => reportComparisonId(item) === id)) {
    throw new Error('CG-3009 this comparison is already included in reports')
  }
  if (existing.length >= MAX_REPORT_COMPARISONS) {
    throw new Error(
      `CG-3010 reports can include at most ${MAX_REPORT_COMPARISONS} comparisons; remove one first`,
    )
  }
  return withSelections(project, [...existing, structuredClone(comparison)], now)
}

export function removeReportComparison(
  project: ClassGraphProject,
  comparisonId: string,
  now: string,
): ClassGraphProject {
  const existing = project.reporting?.comparisons ?? []
  const remaining = existing.filter((item) => reportComparisonId(item) !== comparisonId)
  if (remaining.length === existing.length) {
    throw new Error('CG-3011 that comparison is not included in reports')
  }
  return withSelections(project, remaining, now)
}

/** Selections that still reference a metric are dropped when that metric is removed. */
export function withoutComparisonsForMetric(
  comparisons: ReportComparison[],
  metricKey: string,
): ReportComparison[] {
  return comparisons.filter((comparison) => {
    switch (comparison.kind) {
      case 'crosstab':
        return comparison.rowMetricKey !== metricKey && comparison.columnMetricKey !== metricKey
      case 'association':
        return comparison.xMetricKey !== metricKey && comparison.yMetricKey !== metricKey
      case 'group-summary':
        return comparison.metricKey !== metricKey
    }
  })
}

export function buildReportComparisonResults(project: ClassGraphProject): ReportComparisonResult[] {
  return (project.reporting?.comparisons ?? []).map((selection) => {
    const id = reportComparisonId(selection)
    switch (selection.kind) {
      case 'crosstab':
        return {
          id,
          selection,
          crossTab: buildCrossTab(project, selection.rowMetricKey, selection.columnMetricKey),
        }
      case 'association': {
        const scatter = buildScatterView(project, selection.xMetricKey, selection.yMetricKey)
        return {
          id,
          selection,
          association: {
            xMetricKey: scatter.xMetricKey,
            yMetricKey: scatter.yMetricKey,
            xLabel: scatter.xLabel,
            yLabel: scatter.yLabel,
            omittedCount: scatter.omittedCount,
            association: scatter.association,
          },
        }
      }
      case 'group-summary':
        return {
          id,
          selection,
          groupSummary: buildGroupSummary(project, selection.metricKey, selection.basis),
        }
    }
  })
}
