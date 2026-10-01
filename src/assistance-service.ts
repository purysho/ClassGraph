import { randomUUID } from 'node:crypto'
import { buildProjectAnalysis } from './analysis-view.js'
import { draftAnalysisExplanation } from './assistance-analysis.js'
import {
  assistanceRequestEnvelopeSchema,
  type AssistanceExecutionMode,
  type AssistanceProposal,
  type AssistanceRequestEnvelope,
  type AssistanceTask,
} from './assistance-contract.js'
import { buildAssistanceDisclosure } from './assistance-context.js'
import { draftPlanningRuleSuggestions } from './assistance-planning.js'
import type { AssistanceProvider, AssistanceProviderStatus } from './assistance-provider.js'
import { draftReportWording } from './assistance-report.js'
import { draftSyntheticSpecProposal } from './assistance-synthetic.js'
import type { ClassGraphProject } from './model.js'
import { buildReportSnapshot } from './report-model.js'

export interface AssistanceServiceStatus {
  offlineAvailable: true
  network: AssistanceProviderStatus
}

export interface AssistanceRunInput {
  project: ClassGraphProject
  task: AssistanceTask
  mode: AssistanceExecutionMode
  prompt?: string
  requestId?: string
  confirmSend?: boolean
}

export interface AssistanceRunResult {
  request: AssistanceRequestEnvelope
  proposal: AssistanceProposal
}

export function assistanceServiceStatus(provider?: AssistanceProvider): AssistanceServiceStatus {
  return {
    offlineAvailable: true,
    network: provider?.status() ?? { enabled: false, mode: 'network' },
  }
}

function requestPayload(
  task: AssistanceTask,
  prompt: string | undefined,
  disclosure: AssistanceRequestEnvelope['disclosure'],
): unknown {
  return {
    task,
    ...(prompt?.trim() ? { prompt: prompt.trim() } : {}),
    context: disclosure.items.map((item) => ({
      id: item.id,
      label: item.label,
      scope: item.scope,
      content: item.content,
    })),
    responseRule:
      'Return a ClassGraph assistance proposal v1.0 with status "proposal"; do not claim to mutate project data.',
  }
}

export function buildAssistanceRequest(
  input: AssistanceRunInput,
  provider?: AssistanceProvider,
): AssistanceRequestEnvelope {
  if (input.mode === 'network' && !provider) {
    throw new Error('CG-6006 no network assistance provider is configured')
  }

  const providerLabel = input.mode === 'network' ? provider?.label : undefined
  const disclosure = buildAssistanceDisclosure(
    input.project,
    input.task,
    input.mode,
    providerLabel,
    input.prompt,
  )

  return assistanceRequestEnvelopeSchema.parse({
    version: '1.0',
    requestId: input.requestId ?? randomUUID(),
    task: input.task,
    disclosure,
    payload: requestPayload(input.task, input.prompt, disclosure),
  })
}

function runOffline(
  request: AssistanceRequestEnvelope,
  project: ClassGraphProject,
): AssistanceProposal {
  switch (request.task) {
    case 'synthetic-spec-draft': {
      const promptItem = request.disclosure.items.find((item) => item.scope === 'teacher-prompt')
      const prompt = typeof promptItem?.content === 'string' ? promptItem.content : ''
      return draftSyntheticSpecProposal({
        requestId: request.requestId,
        prompt,
        projectId: `${project.projectId}-synthetic-draft`,
        title: `${project.title} — synthetic draft`,
      })
    }
    case 'analysis-explanation':
      return draftAnalysisExplanation(buildProjectAnalysis(project), request.requestId)
    case 'report-wording-draft':
      return draftReportWording(buildReportSnapshot(project), request.requestId)
    case 'planning-rule-suggestions':
      return draftPlanningRuleSuggestions(project, request.requestId)
  }
}

export async function runAssistance(
  input: AssistanceRunInput,
  provider?: AssistanceProvider,
): Promise<AssistanceRunResult> {
  const request = buildAssistanceRequest(input, provider)
  const proposal =
    input.mode === 'offline'
      ? runOffline(request, input.project)
      : await provider!.execute(request, { confirmed: input.confirmSend === true })

  return { request, proposal }
}
