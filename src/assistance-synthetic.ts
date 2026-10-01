import { type SyntheticSpecDraftProposal } from './assistance-contract.js'
import {
  parseStructuredSyntheticRequest,
  type StructuredSyntheticRequest,
} from './synthetic-request.js'

export interface SyntheticSpecDraftInput {
  requestId: string
  prompt: string
  projectId: string
  title?: string
  seed?: string
  providerLabel?: string
}

const BLOCKED_TRAIT_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\b(?:iq|intelligence)\b/i, label: 'intelligence' },
  { pattern: /\bpersonality\b/i, label: 'personality' },
  { pattern: /\bmotivation\b/i, label: 'motivation' },
  { pattern: /\b(?:adhd|autism|diagnos(?:is|e|ed|tic))\b/i, label: 'diagnosis' },
  { pattern: /\b(?:social status|popularity)\b/i, label: 'social status' },
  { pattern: /\bfriendship\b/i, label: 'friendship' },
  { pattern: /\bconflict\b/i, label: 'conflict' },
  {
    pattern: /\b(?:future attainment|predicted attainment|future grade|predicted grade)\b/i,
    label: 'future attainment',
  },
]

function safeKey(label: string, fallbackIndex: number): string {
  const key = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return key || `metric-${fallbackIndex + 1}`
}

function numberFrom(match: RegExpMatchArray | null, index: number): number | undefined {
  if (!match?.[index]) return undefined
  const value = Number(match[index])
  return Number.isFinite(value) ? value : undefined
}

function missingRate(clause: string): number | undefined {
  const match = clause.match(/\bmissing\s+(\d+(?:\.\d+)?)\s*%/i)
  if (!match?.[1]) return undefined
  const rate = Number(match[1]) / 100
  return Number.isFinite(rate) && rate >= 0 && rate <= 1 ? rate : undefined
}

function weightedValues(raw: string): Array<{ value: string; weight: number }> {
  return raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const [valuePart, weightPart] = item.split(':').map((part) => part.trim())
      const weight = weightPart ? Number(weightPart) : 1
      return {
        value: valuePart ?? '',
        weight: Number.isFinite(weight) && weight > 0 ? weight : 1,
      }
    })
    .filter((item) => item.value.length > 0)
}

function stripMissingSuffix(value: string): string {
  return value.replace(/\bmissing\s+\d+(?:\.\d+)?\s*%.*$/i, '').trim()
}

function metricFromClause(
  clause: string,
  index: number,
  warnings: string[],
): {
  definition: StructuredSyntheticRequest['metricDefinitions'][number]
  metric: StructuredSyntheticRequest['metrics'][number]
} | null {
  const trimmed = clause.trim()
  if (!/^metric\s+/i.test(trimmed)) return null

  for (const blocked of BLOCKED_TRAIT_PATTERNS) {
    if (blocked.pattern.test(trimmed)) {
      warnings.push(
        `Skipped a requested ${blocked.label} metric because assistance does not create hidden-trait, diagnostic, social-status, relationship, or future-attainment labels.`,
      )
      return null
    }
  }

  const body = trimmed.replace(/^metric\s+/i, '').trim()
  const keywordMatch = body.match(/\s+(mean|uniform|categories?|ordinal|boolean)\b/i)
  if (!keywordMatch?.index || !keywordMatch[1]) {
    warnings.push(
      `Could not interpret metric clause "${trimmed}". Use an explicit form such as "metric assessment mean 70 sd 10 range 0-100".`,
    )
    return null
  }

  const label = body
    .slice(0, keywordMatch.index)
    .replace(/^["']|["']$/g, '')
    .trim()
  if (!label) {
    warnings.push(`Skipped metric clause "${trimmed}" because it has no metric name.`)
    return null
  }

  const keyword = keywordMatch[1].toLowerCase()
  const tail = body.slice(keywordMatch.index + keywordMatch[0].length).trim()
  const key = safeKey(label, index)
  const rate = missingRate(trimmed)

  if (keyword === 'mean') {
    const meanMatch = tail.match(/^(-?\d+(?:\.\d+)?)/)
    const sdMatch = tail.match(/\b(?:sd|standard deviation)\s+(-?\d+(?:\.\d+)?)/i)
    const rangeMatch = tail.match(/\brange\s+(-?\d+(?:\.\d+)?)\s*(?:-|to)\s*(-?\d+(?:\.\d+)?)/i)
    const mean = numberFrom(meanMatch, 1)
    const standardDeviation = numberFrom(sdMatch, 1)
    const min = numberFrom(rangeMatch, 1)
    const max = numberFrom(rangeMatch, 2)

    if (mean === undefined || standardDeviation === undefined || standardDeviation <= 0) {
      warnings.push(
        `Skipped numeric metric "${label}" because mean and a positive SD were not both explicit.`,
      )
      return null
    }
    if (min !== undefined && max !== undefined && min > max) {
      warnings.push(
        `Skipped numeric metric "${label}" because its range minimum exceeds its maximum.`,
      )
      return null
    }

    return {
      definition: {
        key,
        label,
        kind: 'number',
        ...(min !== undefined || max !== undefined
          ? {
              numberScale: {
                ...(min !== undefined ? { min } : {}),
                ...(max !== undefined ? { max } : {}),
              },
            }
          : {}),
        ...(rate !== undefined ? { missingAllowed: rate > 0 } : {}),
      },
      metric: {
        key,
        kind: 'number',
        distribution: {
          type: 'normal',
          mean,
          standardDeviation,
          ...(min !== undefined ? { min } : {}),
          ...(max !== undefined ? { max } : {}),
        },
        ...(rate !== undefined ? { missingRate: rate } : {}),
      },
    }
  }

  if (keyword === 'uniform') {
    const rangeMatch = tail.match(/^(-?\d+(?:\.\d+)?)\s*(?:-|to)\s*(-?\d+(?:\.\d+)?)/i)
    const min = numberFrom(rangeMatch, 1)
    const max = numberFrom(rangeMatch, 2)
    if (min === undefined || max === undefined || min > max) {
      warnings.push(
        `Skipped uniform metric "${label}" because an explicit valid minimum-to-maximum range was not provided.`,
      )
      return null
    }

    return {
      definition: {
        key,
        label,
        kind: 'number',
        numberScale: { min, max },
        ...(rate !== undefined ? { missingAllowed: rate > 0 } : {}),
      },
      metric: {
        key,
        kind: 'number',
        distribution: { type: 'uniform', min, max },
        ...(rate !== undefined ? { missingRate: rate } : {}),
      },
    }
  }

  if (keyword === 'category' || keyword === 'categories') {
    const values = weightedValues(stripMissingSuffix(tail))
    if (values.length === 0) {
      warnings.push(`Skipped category metric "${label}" because no explicit values were provided.`)
      return null
    }
    const categories = values.map((item) => item.value)
    return {
      definition: {
        key,
        label,
        kind: 'category',
        categories,
        ...(rate !== undefined ? { missingAllowed: rate > 0 } : {}),
      },
      metric: {
        key,
        kind: 'category',
        values,
        ...(rate !== undefined ? { missingRate: rate } : {}),
      },
    }
  }

  if (keyword === 'ordinal') {
    const values = weightedValues(stripMissingSuffix(tail))
    if (values.length === 0) {
      warnings.push(
        `Skipped ordinal metric "${label}" because no explicit ordered values were provided.`,
      )
      return null
    }
    const ordinalScale = values.map((item) => item.value)
    return {
      definition: {
        key,
        label,
        kind: 'ordinal',
        ordinalScale,
        ...(rate !== undefined ? { missingAllowed: rate > 0 } : {}),
      },
      metric: {
        key,
        kind: 'ordinal',
        values,
        ...(rate !== undefined ? { missingRate: rate } : {}),
      },
    }
  }

  const trueRateMatch = tail.match(/\btrue\s+(\d+(?:\.\d+)?)\s*%/i)
  const trueRatePercent = numberFrom(trueRateMatch, 1)
  if (trueRatePercent === undefined || trueRatePercent < 0 || trueRatePercent > 100) {
    warnings.push(
      `Skipped boolean metric "${label}" because an explicit true percentage from 0% to 100% was not provided.`,
    )
    return null
  }

  return {
    definition: {
      key,
      label,
      kind: 'boolean',
      ...(rate !== undefined ? { missingAllowed: rate > 0 } : {}),
    },
    metric: {
      key,
      kind: 'boolean',
      trueRate: trueRatePercent / 100,
      ...(rate !== undefined ? { missingRate: rate } : {}),
    },
  }
}

export function draftSyntheticSpecProposal(
  input: SyntheticSpecDraftInput,
): SyntheticSpecDraftProposal {
  const prompt = input.prompt.trim()
  if (!prompt) throw new Error('CG-6003 synthetic drafting requires a teacher prompt')

  const warnings: string[] = []
  const assumptions: string[] = []
  const countMatch = prompt.match(/\b(\d{1,3})\s+(?:students?|learners?|pupils?)\b/i)
  let studentCount = countMatch?.[1] ? Number(countMatch[1]) : 30
  if (!countMatch) assumptions.push('Used 30 students because no explicit class size was provided.')
  if (!Number.isInteger(studentCount) || studentCount < 1 || studentCount > 500) {
    warnings.push(
      'The requested class size was outside the supported 1–500 range; used 30 students.',
    )
    studentCount = 30
  }

  const clauses = prompt
    .split(/[;\n]+/)
    .map((item) => item.trim())
    .filter(Boolean)

  const definitions: StructuredSyntheticRequest['metricDefinitions'] = []
  const metrics: StructuredSyntheticRequest['metrics'] = []
  const seenKeys = new Set<string>()

  for (const [index, clause] of clauses.entries()) {
    const parsed = metricFromClause(clause, index, warnings)
    if (!parsed) continue
    if (seenKeys.has(parsed.definition.key)) {
      warnings.push(
        `Skipped duplicate synthetic metric key "${parsed.definition.key}". Rename one metric before generation.`,
      )
      continue
    }
    seenKeys.add(parsed.definition.key)
    definitions.push(parsed.definition)
    metrics.push(parsed.metric)
  }

  if (metrics.length === 0) {
    warnings.push(
      'No supported metric clauses were accepted. The draft remains valid and editable, but generation would currently create students without metric values.',
    )
  }

  const specification = parseStructuredSyntheticRequest({
    projectId: input.projectId,
    title: input.title?.trim() || 'Synthetic Class',
    studentCount,
    seed: input.seed?.trim() || 'classgraph-assistance',
    metricDefinitions: definitions,
    metrics,
  })

  if (!input.seed?.trim()) {
    assumptions.push('Used the deterministic seed "classgraph-assistance".')
  }

  return {
    version: '1.0',
    proposalId: `proposal-${input.requestId}`,
    requestId: input.requestId,
    task: 'synthetic-spec-draft',
    status: 'proposal',
    ...(input.providerLabel ? { providerLabel: input.providerLabel } : {}),
    warnings,
    assumptions,
    specification,
  }
}
