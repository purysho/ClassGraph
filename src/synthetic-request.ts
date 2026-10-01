import { z } from 'zod'
import type { SyntheticClassSpec } from './synthetic.js'

const metricDefinitionSchema = z
  .object({
    key: z
      .string()
      .min(1)
      .regex(/^[a-z0-9][a-z0-9._-]*$/i),
    label: z.string().min(1),
    kind: z.enum(['number', 'ordinal', 'category', 'boolean', 'text']),
    description: z.string().optional(),
    numberScale: z
      .object({
        min: z.number().finite().optional(),
        max: z.number().finite().optional(),
        unit: z.string().optional(),
      })
      .optional(),
    ordinalScale: z.array(z.string().min(1)).min(1).optional(),
    categories: z.array(z.string().min(1)).min(1).optional(),
    missingAllowed: z.boolean().optional(),
  })
  .superRefine((definition, ctx) => {
    if (
      definition.numberScale?.min !== undefined &&
      definition.numberScale.max !== undefined &&
      definition.numberScale.min > definition.numberScale.max
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['numberScale'],
        message: 'numberScale.min must be less than or equal to numberScale.max',
      })
    }
    if (definition.kind === 'ordinal' && !definition.ordinalScale) {
      ctx.addIssue({
        code: 'custom',
        path: ['ordinalScale'],
        message: 'ordinal metrics require ordinalScale',
      })
    }
    if (definition.kind === 'category' && !definition.categories) {
      ctx.addIssue({
        code: 'custom',
        path: ['categories'],
        message: 'category metrics require categories',
      })
    }
  })

const missingRateSchema = z.number().min(0).max(1).optional()

const numericDistributionSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('uniform'),
    min: z.number().finite(),
    max: z.number().finite(),
    decimals: z.number().int().min(0).max(6).optional(),
  }),
  z.object({
    type: z.literal('normal'),
    mean: z.number().finite(),
    standardDeviation: z.number().finite().positive(),
    min: z.number().finite().optional(),
    max: z.number().finite().optional(),
    decimals: z.number().int().min(0).max(6).optional(),
  }),
])

const weightedValueSchema = z.object({
  value: z.string().min(1),
  weight: z.number().finite().positive(),
})

const syntheticMetricSchema = z.discriminatedUnion('kind', [
  z.object({
    key: z.string().min(1),
    kind: z.literal('number'),
    distribution: numericDistributionSchema,
    missingRate: missingRateSchema,
  }),
  z.object({
    key: z.string().min(1),
    kind: z.literal('category'),
    values: z.array(weightedValueSchema).min(1),
    missingRate: missingRateSchema,
  }),
  z.object({
    key: z.string().min(1),
    kind: z.literal('ordinal'),
    values: z.array(weightedValueSchema).min(1),
    missingRate: missingRateSchema,
  }),
  z.object({
    key: z.string().min(1),
    kind: z.literal('boolean'),
    trueRate: z.number().min(0).max(1),
    missingRate: missingRateSchema,
  }),
  z.object({
    key: z.string().min(1),
    kind: z.literal('text'),
    value: z.string().optional(),
    missingRate: missingRateSchema,
  }),
])

const requestSchema = z
  .object({
    projectId: z.string().min(1),
    title: z.string().min(1),
    studentCount: z.number().int().min(1).max(500),
    seed: z.string().min(1),
    metricDefinitions: z.array(metricDefinitionSchema),
    metrics: z.array(syntheticMetricSchema),
  })
  .superRefine((request, ctx) => {
    const definitions = new Map(request.metricDefinitions.map((item) => [item.key, item]))
    if (definitions.size !== request.metricDefinitions.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['metricDefinitions'],
        message: 'metric definition keys must be unique',
      })
    }

    const metricKeys = new Set<string>()
    for (const [index, metric] of request.metrics.entries()) {
      if (metricKeys.has(metric.key)) {
        ctx.addIssue({
          code: 'custom',
          path: ['metrics', index, 'key'],
          message: `duplicate synthetic metric key: ${metric.key}`,
        })
      }
      metricKeys.add(metric.key)

      const definition = definitions.get(metric.key)
      if (!definition) {
        ctx.addIssue({
          code: 'custom',
          path: ['metrics', index, 'key'],
          message: `synthetic metric has no definition: ${metric.key}`,
        })
      } else if (definition.kind !== metric.kind) {
        ctx.addIssue({
          code: 'custom',
          path: ['metrics', index, 'kind'],
          message: `synthetic metric kind does not match definition: ${metric.key}`,
        })
      }
    }
  })

export type StructuredSyntheticRequest = Omit<SyntheticClassSpec, 'generatedAt'>

export function parseStructuredSyntheticRequest(value: unknown): StructuredSyntheticRequest {
  const result = requestSchema.safeParse(value)
  if (!result.success) {
    const issue = result.error.issues[0]
    const location = issue?.path.length ? ` at ${issue.path.join('.')}` : ''
    throw new Error(
      `CG-1001 invalid synthetic specification${location}: ${issue?.message ?? 'validation failed'}`,
    )
  }

  return result.data
}
