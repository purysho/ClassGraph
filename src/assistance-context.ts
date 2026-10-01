import { buildProjectAnalysis } from './analysis-view.js'
import {
  buildAssistanceTransmissionPreview,
  type AssistanceContextItem,
  type AssistanceExecutionMode,
  type AssistanceTask,
  type AssistanceTransmissionPreview,
} from './assistance-contract.js'
import type { ClassGraphProject } from './model.js'
import { buildReportSnapshot } from './report-model.js'

function promptItem(prompt: string | undefined): AssistanceContextItem[] {
  const text = prompt?.trim()
  if (!text) return []
  return [
    {
      id: 'teacher-prompt',
      label: 'Teacher prompt',
      scope: 'teacher-prompt',
      content: text,
      containsStudentIds: false,
      containsDisplayNames: false,
      containsFreeText: true,
      syntheticOnly: false,
    },
  ]
}

export function buildAssistanceContextItems(
  project: ClassGraphProject,
  task: AssistanceTask,
  prompt?: string,
): AssistanceContextItem[] {
  const items = promptItem(prompt)

  if (task === 'synthetic-spec-draft') return items

  if (task === 'analysis-explanation') {
    items.push({
      id: 'aggregate-analysis',
      label: 'Aggregate descriptive analysis',
      scope: 'aggregate-analysis',
      content: buildProjectAnalysis(project),
      containsStudentIds: false,
      containsDisplayNames: false,
      containsFreeText: false,
      syntheticOnly: false,
    })
    return items
  }

  if (task === 'report-wording-draft') {
    const snapshot = buildReportSnapshot(project)
    items.push(
      {
        id: 'project-metadata',
        label: 'Project metadata',
        scope: 'project-metadata',
        content: {
          title: snapshot.project.title,
          classInfo: snapshot.project.classInfo,
        },
        containsStudentIds: false,
        containsDisplayNames: false,
        containsFreeText: true,
        syntheticOnly: false,
      },
      {
        id: 'redacted-report-summary',
        label: 'Redacted report summary',
        scope: 'aggregate-analysis',
        content: {
          analysis: snapshot.analysis,
          provenanceSummary: snapshot.provenanceSummary,
          syntheticPathCount: snapshot.syntheticPaths.length,
          planningSummary: {
            assignmentCount: snapshot.planning?.assignments?.length ?? 0,
            groupCount: snapshot.planning?.groups?.length ?? 0,
            ruleCount: snapshot.planning?.rules?.length ?? 0,
          },
          limitations: snapshot.limitations,
        },
        containsStudentIds: false,
        containsDisplayNames: false,
        containsFreeText: true,
        syntheticOnly: false,
      },
    )
    return items
  }

  items.push({
    id: 'explicit-relationships',
    label: 'Explicit relationship records (names removed)',
    scope: 'relationships',
    content: (project.relationships ?? []).map((relationship) => ({
      id: relationship.id,
      fromStudentId: relationship.fromStudentId,
      toStudentId: relationship.toStudentId,
      type: relationship.type,
      directed: relationship.directed ?? false,
      ...(relationship.weight !== undefined ? { weight: relationship.weight } : {}),
    })),
    containsStudentIds: (project.relationships?.length ?? 0) > 0,
    containsDisplayNames: false,
    containsFreeText: false,
    syntheticOnly: false,
  })
  items.push({
    id: 'existing-planning-rules',
    label: 'Existing explicit planning rules',
    scope: 'planning',
    content: project.planning?.rules ?? [],
    containsStudentIds: (project.planning?.rules?.length ?? 0) > 0,
    containsDisplayNames: false,
    containsFreeText: Boolean(
      project.planning?.rules?.some((rule) => typeof rule.label === 'string' && rule.label.length > 0),
    ),
    syntheticOnly: false,
  })
  return items
}

export function buildAssistanceDisclosure(
  project: ClassGraphProject,
  task: AssistanceTask,
  mode: AssistanceExecutionMode,
  providerLabel?: string,
  prompt?: string,
): AssistanceTransmissionPreview {
  return buildAssistanceTransmissionPreview(
    mode,
    buildAssistanceContextItems(project, task, prompt),
    providerLabel,
  )
}
