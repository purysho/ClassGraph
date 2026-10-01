import type {
  ClassGraphProject,
  MetricDefinition,
  MetricValue,
  ProvenanceEntry,
  StudentRecord,
} from './model.js'
import { deterministicNormal, deterministicUnit } from './random.js'

export type NumericDistribution =
  | { type: 'uniform'; min: number; max: number; decimals?: number }
  | {
      type: 'normal'
      mean: number
      standardDeviation: number
      min?: number
      max?: number
      decimals?: number
    }

export interface WeightedCategory {
  value: string
  weight: number
}

export type SyntheticMetricSpec =
  | { key: string; kind: 'number'; distribution: NumericDistribution; missingRate?: number }
  | {
      key: string
      kind: 'category' | 'ordinal'
      values: WeightedCategory[]
      missingRate?: number
    }
  | { key: string; kind: 'boolean'; trueRate: number; missingRate?: number }
  | { key: string; kind: 'text'; value?: string; missingRate?: number }

export interface SyntheticClassSpec {
  seed: string
  projectId: string
  title: string
  studentCount: number
  metricDefinitions: MetricDefinition[]
  metrics: SyntheticMetricSpec[]
  generatedAt?: string
}

function clamp(value: number, min?: number, max?: number): number {
  let result = value
  if (min !== undefined) result = Math.max(result, min)
  if (max !== undefined) result = Math.min(result, max)
  return result
}

function round(value: number, decimals = 2): number {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

function weightedValue(seed: string, key: string, values: WeightedCategory[]): string {
  const total = values.reduce((sum, item) => sum + Math.max(0, item.weight), 0)
  if (total <= 0) {
    throw new Error('CG-2001 category weights must include a positive value')
  }

  let cursor = deterministicUnit(seed, key) * total
  for (const item of values) {
    cursor -= Math.max(0, item.weight)
    if (cursor <= 0) return item.value
  }
  return values.at(-1)?.value ?? ''
}

function generateMetricValue(
  spec: SyntheticMetricSpec,
  seed: string,
  studentIndex: number,
): MetricValue {
  const prefix = `student:${studentIndex}:metric:${spec.key}`
  const missingRate = spec.missingRate ?? 0
  if (missingRate < 0 || missingRate > 1) {
    throw new Error(`CG-2002 invalid missingRate for ${spec.key}`)
  }
  if (deterministicUnit(seed, `${prefix}:missing`) < missingRate) return null

  switch (spec.kind) {
    case 'number': {
      if (spec.distribution.type === 'uniform') {
        const value =
          spec.distribution.min +
          deterministicUnit(seed, `${prefix}:value`) *
            (spec.distribution.max - spec.distribution.min)
        return round(value, spec.distribution.decimals)
      }

      const value =
        spec.distribution.mean +
        deterministicNormal(seed, `${prefix}:value`) * spec.distribution.standardDeviation
      return round(
        clamp(value, spec.distribution.min, spec.distribution.max),
        spec.distribution.decimals,
      )
    }
    case 'category':
    case 'ordinal':
      return weightedValue(seed, `${prefix}:value`, spec.values)
    case 'boolean': {
      if (spec.trueRate < 0 || spec.trueRate > 1) {
        throw new Error(`CG-2003 invalid trueRate for ${spec.key}`)
      }
      return deterministicUnit(seed, `${prefix}:value`) < spec.trueRate
    }
    case 'text':
      return spec.value ?? ''
  }
}

function syntheticProvenance(source: string): ProvenanceEntry {
  return { kind: 'synthetic', source }
}

export function generateSyntheticProject(spec: SyntheticClassSpec): ClassGraphProject {
  if (!Number.isInteger(spec.studentCount) || spec.studentCount < 1 || spec.studentCount > 500) {
    throw new Error('CG-2004 studentCount must be an integer from 1 to 500')
  }

  const metricDefinitionKeys = new Set(spec.metricDefinitions.map((item) => item.key))
  for (const metric of spec.metrics) {
    if (!metricDefinitionKeys.has(metric.key)) {
      throw new Error(`CG-2005 synthetic metric has no definition: ${metric.key}`)
    }
  }

  const students: StudentRecord[] = []
  const provenance: ClassGraphProject['provenance'] = {
    '/projectId': syntheticProvenance('synthetic-class-spec'),
    '/title': syntheticProvenance('synthetic-class-spec'),
  }

  for (let index = 0; index < spec.studentCount; index += 1) {
    const studentNumber = index + 1
    const studentId = `student-${String(studentNumber).padStart(3, '0')}`
    const metrics: Record<string, MetricValue> = {}

    for (const metric of spec.metrics) {
      metrics[metric.key] = generateMetricValue(metric, spec.seed, index)
      provenance[`/students/${index}/metrics/${metric.key}`] = syntheticProvenance(
        `seed:${spec.seed}`,
      )
    }

    students.push({
      id: studentId,
      displayName: `Student ${String(studentNumber).padStart(3, '0')}`,
      metrics,
    })

    provenance[`/students/${index}/id`] = syntheticProvenance('synthetic-class-spec')
    provenance[`/students/${index}/displayName`] = syntheticProvenance('synthetic-class-spec')
  }

  const now = spec.generatedAt ?? new Date().toISOString()

  return {
    schemaVersion: '1.0',
    projectId: spec.projectId,
    title: spec.title,
    createdAt: now,
    updatedAt: now,
    classInfo: {},
    metricDefinitions: spec.metricDefinitions,
    students,
    provenance,
  }
}
