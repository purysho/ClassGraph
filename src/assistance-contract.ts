import { z } from 'zod'

export type AssistanceTask =
  | 'synthetic-spec-draft'
  | 'analysis-explanation'
  | 'report-wording-draft'
  | 'planning-rule-suggestions'

export type AssistanceExecutionMode = 'offline' | 'network'

export type AssistanceContextScope =
  | 'teacher-prompt'
  | 'project-metadata'
  | 'aggregate-analysis'
  | 'student-level'
  | 'relationships'
  | 'room'
  | 'planning'
  | 'report-snapshot'

export interface AssistanceContextItem {
  id: string
  label: string
  scope: AssistanceContextScope
  content: unknown
  containsStudentIds: boolean
  containsDisplayNames: boolean
  containsFreeText: boolean
  syntheticOnly: boolean
}

export interface AssistanceTransmissionPreview {
  mode: AssistanceExecutionMode
  providerLabel?: string
  items: AssistanceContextItem[]
  containsStudentLevelData: boolean
  containsRealStudentData: boolean
  containsStudentIds: boolean
  containsDisplayNames: boolean
  containsFreeText: boolean
  requiresExplicitSend: boolean
}

export interface AssistanceRequestEnvelope {
  version: '1.0'
  requestId: string
  task: AssistanceTask
  disclosure: AssistanceTransmissionPreview
  payload: unknown
}

export interface AssistanceProposalBase {
  version: '1.0'
  proposalId: string
  requestId: string
  task: AssistanceTask
  status: 'proposal'
  providerLabel?: string
  warnings: string[]
  assumptions: string[]
}

export interface SyntheticSpecDraftProposal extends AssistanceProposalBase {
  task: 'synthetic-spec-draft'
  specification: unknown
}

export interface AnalysisExplanationProposal extends AssistanceProposalBase {
  task: 'analysis-explanation'
  text: string
  sourceMetricKeys: string[]
  caveats: string[]
}

export interface ReportWordingDraftProposal extends AssistanceProposalBase {
  task: 'report-wording-draft'
  sections: Array<{
    heading: string
    text: string
  }>
}

export interface PlanningRuleSuggestionProposal extends AssistanceProposalBase {
  task: 'planning-rule-suggestions'
  suggestions: Array<{
    rule: unknown
    rationale: string
    inputPaths: string[]
  }>
}

export type AssistanceProposal =
  | SyntheticSpecDraftProposal
  | AnalysisExplanationProposal
  | ReportWordingDraftProposal
  | PlanningRuleSuggestionProposal

const taskSchema = z.enum([
  'synthetic-spec-draft',
  'analysis-explanation',
  'report-wording-draft',
  'planning-rule-suggestions',
])

const contextScopeSchema = z.enum([
  'teacher-prompt',
  'project-metadata',
  'aggregate-analysis',
  'student-level',
  'relationships',
  'room',
  'planning',
  'report-snapshot',
])

const contextItemSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  scope: contextScopeSchema,
  content: z.unknown(),
  containsStudentIds: z.boolean(),
  containsDisplayNames: z.boolean(),
  containsFreeText: z.boolean(),
  syntheticOnly: z.boolean(),
})

export const assistanceTransmissionPreviewSchema = z
  .object({
    mode: z.enum(['offline', 'network']),
    providerLabel: z.string().min(1).optional(),
    items: z.array(contextItemSchema),
    containsStudentLevelData: z.boolean(),
    containsRealStudentData: z.boolean(),
    containsStudentIds: z.boolean(),
    containsDisplayNames: z.boolean(),
    containsFreeText: z.boolean(),
    requiresExplicitSend: z.boolean(),
  })
  .superRefine((preview, ctx) => {
    if (preview.mode === 'network' && !preview.requiresExplicitSend) {
      ctx.addIssue({
        code: 'custom',
        path: ['requiresExplicitSend'],
        message: 'network assistance must require an explicit send action',
      })
    }
    if (preview.mode === 'offline' && preview.requiresExplicitSend) {
      ctx.addIssue({
        code: 'custom',
        path: ['requiresExplicitSend'],
        message: 'offline assistance must not claim a network send action is required',
      })
    }
  })

export const assistanceRequestEnvelopeSchema = z
  .object({
    version: z.literal('1.0'),
    requestId: z.string().min(1),
    task: taskSchema,
    disclosure: assistanceTransmissionPreviewSchema,
    payload: z.unknown(),
  })
  .superRefine((request, ctx) => {
    if (request.disclosure.mode === 'network' && !request.disclosure.providerLabel) {
      ctx.addIssue({
        code: 'custom',
        path: ['disclosure', 'providerLabel'],
        message: 'network assistance requires a visible provider label',
      })
    }
  })

const proposalBase = {
  version: z.literal('1.0'),
  proposalId: z.string().min(1),
  requestId: z.string().min(1),
  status: z.literal('proposal'),
  providerLabel: z.string().min(1).optional(),
  warnings: z.array(z.string()),
  assumptions: z.array(z.string()),
}

export const assistanceProposalSchema = z.discriminatedUnion('task', [
  z.object({
    ...proposalBase,
    task: z.literal('synthetic-spec-draft'),
    specification: z.unknown(),
  }),
  z.object({
    ...proposalBase,
    task: z.literal('analysis-explanation'),
    text: z.string(),
    sourceMetricKeys: z.array(z.string().min(1)),
    caveats: z.array(z.string()),
  }),
  z.object({
    ...proposalBase,
    task: z.literal('report-wording-draft'),
    sections: z.array(
      z.object({
        heading: z.string().min(1),
        text: z.string(),
      }),
    ),
  }),
  z.object({
    ...proposalBase,
    task: z.literal('planning-rule-suggestions'),
    suggestions: z.array(
      z.object({
        rule: z.unknown(),
        rationale: z.string().min(1),
        inputPaths: z.array(z.string().min(1)),
      }),
    ),
  }),
])

export function buildAssistanceTransmissionPreview(
  mode: AssistanceExecutionMode,
  items: AssistanceContextItem[],
  providerLabel?: string,
): AssistanceTransmissionPreview {
  const containsStudentLevelData = items.some(
    (item) =>
      item.scope === 'student-level' ||
      item.scope === 'relationships' ||
      item.scope === 'planning' ||
      item.scope === 'report-snapshot',
  )
  const containsRealStudentData = items.some(
    (item) =>
      !item.syntheticOnly &&
      (item.scope === 'student-level' ||
        item.scope === 'relationships' ||
        item.scope === 'planning' ||
        item.scope === 'report-snapshot'),
  )

  const preview: AssistanceTransmissionPreview = {
    mode,
    ...(providerLabel ? { providerLabel } : {}),
    items: structuredClone(items),
    containsStudentLevelData,
    containsRealStudentData,
    containsStudentIds: items.some((item) => item.containsStudentIds),
    containsDisplayNames: items.some((item) => item.containsDisplayNames),
    containsFreeText: items.some((item) => item.containsFreeText),
    requiresExplicitSend: mode === 'network',
  }

  return assistanceTransmissionPreviewSchema.parse(preview)
}

export function parseAssistanceRequestEnvelope(value: unknown): AssistanceRequestEnvelope {
  const result = assistanceRequestEnvelopeSchema.safeParse(value)
  if (!result.success) {
    const issue = result.error.issues[0]
    const location = issue?.path.length ? ` at ${issue.path.join('.')}` : ''
    throw new Error(
      `CG-6001 invalid assistance request${location}: ${issue?.message ?? 'validation failed'}`,
    )
  }
  return result.data
}

export function parseAssistanceProposal(value: unknown): AssistanceProposal {
  const result = assistanceProposalSchema.safeParse(value)
  if (!result.success) {
    const issue = result.error.issues[0]
    const location = issue?.path.length ? ` at ${issue.path.join('.')}` : ''
    throw new Error(
      `CG-6002 invalid assistance proposal${location}: ${issue?.message ?? 'validation failed'}`,
    )
  }
  return result.data
}
