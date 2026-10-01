import type { ClassGraphProject } from './model.js'
import { summarizeCategoryMetric, summarizeNumericMetric } from './analysis.js'

export interface ProjectCompleteness {
  totalCells: number
  recordedCount: number
  explicitMissingCount: number
  unrecordedCount: number
}

export interface HistogramBucket {
  min: number
  max: number
  count: number
}

export interface NumericMetricView {
  kind: 'number'
  key: string
  label: string
  summary: ReturnType<typeof summarizeNumericMetric>
  histogram: HistogramBucket[]
}

export interface CategoryMetricView {
  kind: 'category'
  key: string
  label: string
  sourceKind: 'category' | 'ordinal' | 'boolean' | 'text'
  summary: ReturnType<typeof summarizeCategoryMetric>
}

export type MetricAnalysisView = NumericMetricView | CategoryMetricView

export interface ProjectAnalysisView {
  studentCount: number
  metricCount: number
  completeness: ProjectCompleteness
  metrics: MetricAnalysisView[]
}

export interface ScatterPoint {
  studentId: string
  displayName?: string
  x: number
  y: number
}

export interface ScatterView {
  xMetricKey: string
  yMetricKey: string
  xLabel: string
  yLabel: string
  points: ScatterPoint[]
  omittedCount: number
}

function buildHistogram(values: number[], bucketCount = 6): HistogramBucket[] {
  if (values.length === 0) return []

  const min = Math.min(...values)
  const max = Math.max(...values)
  if (min === max) return [{ min, max, count: values.length }]

  const width = (max - min) / bucketCount
  const buckets = Array.from({ length: bucketCount }, (_, index) => ({
    min: min + width * index,
    max: index === bucketCount - 1 ? max : min + width * (index + 1),
    count: 0,
  }))

  for (const value of values) {
    const rawIndex = Math.floor((value - min) / width)
    const index = Math.min(rawIndex, bucketCount - 1)
    const bucket = buckets[index]
    if (bucket) bucket.count += 1
  }

  return buckets
}

export function buildProjectAnalysis(project: ClassGraphProject): ProjectAnalysisView {
  let recordedCount = 0
  let explicitMissingCount = 0
  let unrecordedCount = 0

  for (const student of project.students) {
    for (const definition of project.metricDefinitions) {
      if (!(definition.key in student.metrics)) {
        unrecordedCount += 1
      } else if (student.metrics[definition.key] === null) {
        explicitMissingCount += 1
      } else {
        recordedCount += 1
      }
    }
  }

  const metrics: MetricAnalysisView[] = project.metricDefinitions.map((definition) => {
    if (definition.kind === 'number') {
      const values = project.students
        .map((student) => student.metrics[definition.key])
        .filter((value): value is number => typeof value === 'number')

      return {
        kind: 'number',
        key: definition.key,
        label: definition.label,
        summary: summarizeNumericMetric(project, definition.key),
        histogram: buildHistogram(values),
      }
    }

    return {
      kind: 'category',
      key: definition.key,
      label: definition.label,
      sourceKind: definition.kind,
      summary: summarizeCategoryMetric(project, definition.key),
    }
  })

  return {
    studentCount: project.students.length,
    metricCount: project.metricDefinitions.length,
    completeness: {
      totalCells: project.students.length * project.metricDefinitions.length,
      recordedCount,
      explicitMissingCount,
      unrecordedCount,
    },
    metrics,
  }
}

export function buildScatterView(
  project: ClassGraphProject,
  xMetricKey: string,
  yMetricKey: string,
): ScatterView {
  const xDefinition = project.metricDefinitions.find((item) => item.key === xMetricKey)
  const yDefinition = project.metricDefinitions.find((item) => item.key === yMetricKey)

  if (!xDefinition || xDefinition.kind !== 'number') {
    throw new Error(`CG-3004 scatter x metric must be numeric: ${xMetricKey}`)
  }
  if (!yDefinition || yDefinition.kind !== 'number') {
    throw new Error(`CG-3005 scatter y metric must be numeric: ${yMetricKey}`)
  }

  const points: ScatterPoint[] = []
  let omittedCount = 0

  for (const student of project.students) {
    const x = student.metrics[xMetricKey]
    const y = student.metrics[yMetricKey]
    if (typeof x !== 'number' || typeof y !== 'number') {
      omittedCount += 1
      continue
    }

    points.push({
      studentId: student.id,
      ...(student.displayName ? { displayName: student.displayName } : {}),
      x,
      y,
    })
  }

  return {
    xMetricKey,
    yMetricKey,
    xLabel: xDefinition.label,
    yLabel: yDefinition.label,
    points,
    omittedCount,
  }
}
