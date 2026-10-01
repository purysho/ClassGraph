import type { ClassGraphProject, MetricDefinition, MetricValue } from './model.js'

export interface NumericSummary {
  metricKey: string
  recordedCount: number
  missingCount: number
  min: number | null
  max: number | null
  mean: number | null
  median: number | null
  q1: number | null
  q3: number | null
}

export interface CategorySummary {
  metricKey: string
  recordedCount: number
  missingCount: number
  counts: Record<string, number>
}

function quantile(sorted: number[], q: number): number | null {
  if (sorted.length === 0) return null
  if (sorted.length === 1) return sorted[0] ?? null
  const position = (sorted.length - 1) * q
  const lowerIndex = Math.floor(position)
  const upperIndex = Math.ceil(position)
  const lower = sorted[lowerIndex]
  const upper = sorted[upperIndex]
  if (lower === undefined || upper === undefined) return null
  if (lowerIndex === upperIndex) return lower
  return lower + (upper - lower) * (position - lowerIndex)
}

function findDefinition(project: ClassGraphProject, metricKey: string): MetricDefinition {
  const definition = project.metricDefinitions.find((item) => item.key === metricKey)
  if (!definition) throw new Error(`CG-3001 unknown metric: ${metricKey}`)
  return definition
}

function collectValues(project: ClassGraphProject, metricKey: string): MetricValue[] {
  return project.students.map((student) => student.metrics[metricKey] ?? null)
}

export function summarizeNumericMetric(
  project: ClassGraphProject,
  metricKey: string,
): NumericSummary {
  const definition = findDefinition(project, metricKey)
  if (definition.kind !== 'number') {
    throw new Error(`CG-3002 metric is not numeric: ${metricKey}`)
  }

  const values = collectValues(project, metricKey)
  const numeric = values
    .filter((value): value is number => typeof value === 'number')
    .sort((a, b) => a - b)
  const missingCount = values.length - numeric.length

  if (numeric.length === 0) {
    return {
      metricKey,
      recordedCount: 0,
      missingCount,
      min: null,
      max: null,
      mean: null,
      median: null,
      q1: null,
      q3: null,
    }
  }

  const sum = numeric.reduce((total, value) => total + value, 0)

  return {
    metricKey,
    recordedCount: numeric.length,
    missingCount,
    min: numeric[0] ?? null,
    max: numeric.at(-1) ?? null,
    mean: sum / numeric.length,
    median: quantile(numeric, 0.5),
    q1: quantile(numeric, 0.25),
    q3: quantile(numeric, 0.75),
  }
}

export function summarizeCategoryMetric(
  project: ClassGraphProject,
  metricKey: string,
): CategorySummary {
  const definition = findDefinition(project, metricKey)
  if (!['category', 'ordinal', 'boolean', 'text'].includes(definition.kind)) {
    throw new Error(`CG-3003 metric is not categorical/textual: ${metricKey}`)
  }

  const values = collectValues(project, metricKey)
  const counts: Record<string, number> = {}
  let missingCount = 0

  for (const value of values) {
    if (value === null) {
      missingCount += 1
      continue
    }
    const key = String(value)
    counts[key] = (counts[key] ?? 0) + 1
  }

  return {
    metricKey,
    recordedCount: values.length - missingCount,
    missingCount,
    counts,
  }
}
