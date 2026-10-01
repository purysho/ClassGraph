import { buildProjectAnalysis } from './analysis-view.js'
import type { ClassGraphProject, PlanningRule } from './model.js'
import { buildReportSnapshot } from './report-model.js'
import { deterministicId } from './stable-id.js'
import { parseStructuredSyntheticRequest } from './synthetic-request.js'
import type {
  AnalysisExplanationProposal,
  PlanningRuleSuggestionProposal,
  ReportWordingDraftProposal,
  SyntheticSpecDraftProposal,
} from './assistance-contract.js'

export interface SyntheticSpecDraftInput {
  requestId: string
  prompt: string
  projectId?: string
  title?: string
  seed?: string
}

const MAX_PROMPT_LENGTH = 4_000
const HIDDEN_TRAIT_PATTERN =
  /\b(iq|intelligence|personality|lazy|laziness|motivation|diagnos\w*|adhd|autis\w*|depress\w*|anxiety|popularity|friendship|future attainment|predict\w*)\b/i

function cleanPrompt(prompt: string): string {
  const value = prompt.trim()
  if (!value) throw new Error('CG-6101 assistance prompt must not be empty')
  if (value.length > MAX_PROMPT_LENGTH) {
    throw new Error(`CG-6101 assistance prompt exceeds ${MAX_PROMPT_LENGTH} characters`)
  }
  if (HIDDEN_TRAIT_PATTERN.test(value)) {
    throw new Error(
      'CG-6102 assistance cannot draft hidden traits, diagnoses, social status, or predictions',
    )
  }
  return value
}

function numericMatch(prompt: string, pattern: RegExp): number | undefined {
  const match = pattern.exec(prompt)
  if (!match?.[1]) return undefined
  const value = Number(match[1])
  return Number.isFinite(value) ? value : undefined
}

function titleCase(value: string): string {
  return value
    .trim()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function metricKey(value: string): string {
  const key = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return key || 'metric'
}

function pushMetric(
  definitions: Array<Record<string, unknown>>,
  metrics: Array<Record<string, unknown>>,
  seenKeys: Set<string>,
  definition: Record<string, unknown> & { key: string },
  metric: Record<string, unknown> & { key: string },
): void {
  if (seenKeys.has(definition.key)) return
  seenKeys.add(definition.key)
  definitions.push(definition)
  metrics.push(metric)
}

function parseExplicitCategoryMetrics(
  prompt: string,
  definitions: Array<Record<string, unknown>>,
  metrics: Array<Record<string, unknown>>,
  seenKeys: Set<string>,
): void {
  const pattern = /(?:metric\s+)?([a-z][a-z0-9 _-]{1,30})\s+(?:categories|levels?)\s*[:=]\s*([^.;]+)/gi
  for (const match of prompt.matchAll(pattern)) {
    const name = match[1]?.trim()
    const rawValues = match[2]
    if (!name || !rawValues) continue
    const values = rawValues
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
      .slice(0, 12)
    if (values.length < 2) continue
    const key = metricKey(name)
    pushMetric(
      definitions,
      metrics,
      seenKeys,
      { key, label: titleCase(name), kind: 'category', categories: values, missingAllowed: true },
      {
        key,
        kind: 'category',
        values: values.map((value) => ({ value, weight: 1 })),
        missingRate: 0,
      },
    )
  }
}

function parseExplicitNumericMetrics(
  prompt: string,
  definitions: Array<Record<string, unknown>>,
  metrics: Array<Record<string, unknown>>,
  seenKeys: Set<string>,
): void {
  const pattern =
    /metric\s+([a-z][a-z0-9 _-]{1,30})\s+(?:from|between)\s*(-?\d+(?:\.\d+)?)\s+(?:to|and)\s*(-?\d+(?:\.\d+)?)(?:\s+(?:around|mean|average(?:\s+of)?)\s*(-?\d+(?:\.\d+)?))?/gi
  for (const match of prompt.matchAll(pattern)) {
    const name = match[1]?.trim()
    const min = Number(match[2])
    const max = Number(match[3])
    const mean = match[4] === undefined ? undefined : Number(match[4])
    if (!name || !Number.isFinite(min) || !Number.isFinite(max) || min > max) continue
    const key = metricKey(name)
    const distribution =
      mean !== undefined && Number.isFinite(mean)
        ? {
            type: 'normal',
            mean,
            standardDeviation: Math.max((max - min) / 6, 0.1),
            min,
            max,
          }
        : { type: 'uniform', min, max }
    pushMetric(
      definitions,
      metrics,
      seenKeys,
      {
        key,
        label: titleCase(name),
        kind: 'number',
        numberScale: { min, max },
        missingAllowed: true,
      },
      { key, kind: 'number', distribution, missingRate: 0 },
    )
  }
}

export function draftSyntheticSpecFromPrompt(
  input: SyntheticSpecDraftInput,
): SyntheticSpecDraftProposal {
  const prompt = cleanPrompt(input.prompt)
  const warnings: string[] = []
  const assumptions: string[] = []

  const requestedCount = numericMatch(prompt, /\b(\d{1,3})\s+(?:students|learners|pupils)\b/i)
  const studentCount = requestedCount ?? 30
  if (requestedCount === undefined) {
    assumptions.push('No class size was stated, so the draft uses 30 students.')
  }

  const definitions: Array<Record<string, unknown>> = []
  const metrics: Array<Record<string, unknown>> = []
  const seenKeys = new Set<string>()

  parseExplicitNumericMetrics(prompt, definitions, metrics, seenKeys)
  parseExplicitCategoryMetrics(prompt, definitions, metrics, seenKeys)

  if (/\b(assessment|test|exam|score|marks?)\b/i.test(prompt) && !seenKeys.has('assessment')) {
    const mean =
      numericMatch(
        prompt,
        /\b(?:assessment|test|exam|score|marks?)(?:\s+scores?)?[^.;]{0,80}?\b(?:around|mean|average(?:\s+of)?)\s*(-?\d+(?:\.\d+)?)/i,
      ) ?? 70
    const standardDeviation =
      numericMatch(prompt, /\b(?:spread|sd|standard deviation)\s*(?:of|=|:)?\s*(\d+(?:\.\d+)?)/i) ??
      12
    if (!/\b(?:around|mean|average(?:\s+of)?)\s*-?\d/i.test(prompt)) {
      assumptions.push('Assessment was mentioned without a centre, so the draft uses mean 70.')
    }
    if (!/\b(?:spread|sd|standard deviation)\b/i.test(prompt)) {
      assumptions.push('Assessment spread was not stated, so the draft uses standard deviation 12.')
    }
    pushMetric(
      definitions,
      metrics,
      seenKeys,
      {
        key: 'assessment',
        label: 'Assessment',
        kind: 'number',
        numberScale: { min: 0, max: 100 },
        missingAllowed: true,
      },
      {
        key: 'assessment',
        kind: 'number',
        distribution: {
          type: 'normal',
          mean,
          standardDeviation,
          min: 0,
          max: 100,
        },
        missingRate: 0,
      },
    )
  }

  if (/\bparticipation\b/i.test(prompt) && !seenKeys.has('participation')) {
    pushMetric(
      definitions,
      metrics,
      seenKeys,
      {
        key: 'participation',
        label: 'Participation',
        kind: 'ordinal',
        ordinalScale: ['1', '2', '3', '4', '5'],
        missingAllowed: true,
      },
      {
        key: 'participation',
        kind: 'ordinal',
        values: [
          { value: '1', weight: 1 },
          { value: '2', weight: 2 },
          { value: '3', weight: 4 },
          { value: '4', weight: 2 },
          { value: '5', weight: 1 },
        ],
        missingRate: 0,
      },
    )
    assumptions.push(
      'Participation was explicitly requested but no distribution was supplied, so the editable draft uses a centred 1–5 weighting.',
    )
  }

  if (definitions.length === 0) {
    warnings.push(
      'No supported metric pattern was recognised. The editable proposal contains only the synthetic roster size.',
    )
  }

  const projectId = input.projectId?.trim() || deterministicId('synthetic-project', prompt)
  const title = input.title?.trim() || 'Synthetic Class Draft'
  const seed = input.seed?.trim() || deterministicId('synthetic-seed', { prompt, studentCount })

  const specification = parseStructuredSyntheticRequest({
    projectId,
    title,
    studentCount,
    seed,
    metricDefinitions: definitions,
    metrics,
  })

  return {
    version: '1.0',
    proposalId: deterministicId('proposal', {
      task: 'synthetic-spec-draft',
      requestId: input.requestId,
      specification,
    }),
    requestId: input.requestId,
    task: 'synthetic-spec-draft',
    status: 'proposal',
    warnings,
    assumptions,
    specification,
  }
}

function percentage(part: number, total: number): string {
  if (total === 0) return '0%'
  return `${Math.round((part / total) * 100)}%`
}

export function draftAnalysisExplanation(
  requestId: string,
  project: ClassGraphProject,
): AnalysisExplanationProposal {
  const analysis = buildProjectAnalysis(project)
  const caveats = [
    'These statements describe the supplied data only; they do not diagnose students or predict future attainment.',
    'Association or co-movement in descriptive views does not establish causation.',
  ]

  if (analysis.completeness.explicitMissingCount > 0 || analysis.completeness.unrecordedCount > 0) {
    caveats.push(
      `${analysis.completeness.explicitMissingCount} cell(s) are explicitly missing and ${analysis.completeness.unrecordedCount} are not recorded; neither is imputed.`,
    )
  }

  const metricSentences = analysis.metrics.map((metric) => {
    if (metric.kind === 'number') {
      const summary = metric.summary
      return `${metric.label}: ${summary.recordedCount} recorded value(s), ${summary.missingCount} missing/not recorded, mean ${summary.mean ?? '—'}, median ${summary.median ?? '—'}, range ${summary.min ?? '—'} to ${summary.max ?? '—'}.`
    }

    const counts = Object.entries(metric.summary.counts)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([value, count]) => `${value}: ${count}`)
      .join(', ')
    return `${metric.label}: ${metric.summary.recordedCount} recorded value(s), ${metric.summary.missingCount} missing/not recorded${counts ? `; counts — ${counts}` : ''}.`
  })

  const text = [
    `The project contains ${analysis.studentCount} student(s) and ${analysis.metricCount} metric(s). ${analysis.completeness.recordedCount} of ${analysis.completeness.totalCells} defined metric cells are recorded (${percentage(analysis.completeness.recordedCount, analysis.completeness.totalCells)}).`,
    ...metricSentences,
  ].join(' ')

  return {
    version: '1.0',
    proposalId: deterministicId('proposal', {
      task: 'analysis-explanation',
      requestId,
      analysis,
    }),
    requestId,
    task: 'analysis-explanation',
    status: 'proposal',
    warnings: [],
    assumptions: [],
    text,
    sourceMetricKeys: analysis.metrics.map((metric) => metric.key),
    caveats,
  }
}

export function draftReportWording(
  requestId: string,
  project: ClassGraphProject,
): ReportWordingDraftProposal {
  const snapshot = buildReportSnapshot(project)
  const completeness = snapshot.analysis.completeness
  const planning = snapshot.planning

  const sections = [
    {
      heading: 'Class overview',
      text: `${snapshot.project.title} contains ${snapshot.analysis.studentCount} student(s) and ${snapshot.analysis.metricCount} defined metric(s). This wording is descriptive and is drafted from the validated ClassGraph report snapshot.`,
    },
    {
      heading: 'Data quality and provenance',
      text: `${completeness.recordedCount} metric cell(s) are recorded, ${completeness.explicitMissingCount} are explicitly missing, and ${completeness.unrecordedCount} are not recorded. Provenance entries remain separated as observed, teacher-entered, imported, derived, or synthetic.`,
    },
    {
      heading: 'Planning',
      text: `The saved planning state contains ${planning?.assignments?.length ?? 0} seating assignment(s), ${planning?.groups?.length ?? 0} group(s), and ${planning?.rules?.length ?? 0} planning rule(s). These are planning records, not predictions of educational outcomes.`,
    },
    {
      heading: 'Limitations',
      text: snapshot.limitations.join(' '),
    },
  ]

  return {
    version: '1.0',
    proposalId: deterministicId('proposal', {
      task: 'report-wording-draft',
      requestId,
      sections,
    }),
    requestId,
    task: 'report-wording-draft',
    status: 'proposal',
    warnings: [],
    assumptions: [],
    sections,
  }
}

function relationshipRule(
  relationship: NonNullable<ClassGraphProject['relationships']>[number],
): PlanningRule | undefined {
  const base = {
    id: deterministicId('assist-rule', {
      relationshipId: relationship.id,
      type: relationship.type,
      from: relationship.fromStudentId,
      to: relationship.toStudentId,
    }),
    studentAId: relationship.fromStudentId,
    studentBId: relationship.toStudentId,
    weight: relationship.weight ?? 1,
  }

  if (relationship.type === 'avoid-pairing') {
    return { ...base, strength: 'soft', kind: 'prefer-apart' }
  }
  if (relationship.type === 'works-well-with' || relationship.type === 'support-pair') {
    return { ...base, strength: 'soft', kind: 'prefer-together' }
  }
  return undefined
}

export function draftPlanningRuleSuggestions(
  requestId: string,
  project: ClassGraphProject,
): PlanningRuleSuggestionProposal {
  const suggestions: PlanningRuleSuggestionProposal['suggestions'] = []
  const warnings: string[] = []

  for (const [index, relationship] of (project.relationships ?? []).entries()) {
    const rule = relationshipRule(relationship)
    if (!rule) continue
    suggestions.push({
      rule,
      rationale:
        relationship.type === 'avoid-pairing'
          ? 'Uses the explicit avoid-pairing relationship as a soft preference; the teacher can strengthen or reject it.'
          : `Uses the explicit ${relationship.type} relationship as a soft prefer-together suggestion.`,
      inputPaths: [`/relationships/${index}`],
    })
  }

  const skipped = (project.relationships ?? []).length - suggestions.length
  if (skipped > 0) {
    warnings.push(
      `${skipped} relationship record(s) were not converted because friendship/custom relationships do not map automatically to a planning rule.`,
    )
  }
  if (suggestions.length === 0) {
    warnings.push('No explicit relationship record maps conservatively to a supported planning rule.')
  }

  return {
    version: '1.0',
    proposalId: deterministicId('proposal', {
      task: 'planning-rule-suggestions',
      requestId,
      suggestions,
    }),
    requestId,
    task: 'planning-rule-suggestions',
    status: 'proposal',
    warnings,
    assumptions: [],
    suggestions,
  }
}
