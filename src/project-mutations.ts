import { z } from 'zod'
import type { ClassGraphProject } from './model.js'
import { recordApprovedSeatingHistory, removeApprovedSeatingHistory } from './planning-history.js'
import { removePlanningScenario, savePlanningScenario } from './planning-scenarios.js'
import {
  addMetricDefinition,
  removeMetricDefinition,
  setStudentMetricValue,
  unsetStudentMetricValue,
} from './metrics.js'
import {
  addPlanningRule,
  assignStudentToSeat,
  removePlanningRule,
  replacePlanningGroups,
  replaceSeatAssignments,
  setGroupStudentLocked,
  setPlanningSeed,
  setSeatAssignmentLocked,
  unassignStudentFromSeat,
} from './planning-state.js'
import { addRelationship, removeRelationship, updateRelationship } from './relationships.js'
import { addReportComparison, removeReportComparison } from './report-comparisons.js'
import { setGridRoom, setRoomFront, setSeatEnabled, setSeatTags } from './room.js'
import {
  classGraphProjectSchema,
  planningAssignmentSchema,
  planningGroupSchema,
  planningRuleSchema,
  relationshipSchema,
  reportComparisonSchema,
} from './schema.js'
import { addStudent, removeStudent, updateStudent } from './workspace.js'

const metricValueSchema = z.union([z.number().finite(), z.string(), z.boolean(), z.null()])

const metricDefinitionSchema = z.object({
  key: z.string().min(1),
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
  ordinalScale: z.array(z.string().min(1)).optional(),
  categories: z.array(z.string().min(1)).optional(),
  missingAllowed: z.boolean().optional(),
})

const relationshipPatchSchema = z.object({
  fromStudentId: z.string().min(1).optional(),
  toStudentId: z.string().min(1).optional(),
  type: z
    .enum(['works-well-with', 'avoid-pairing', 'support-pair', 'friendship', 'custom'])
    .optional(),
  label: z.string().nullable().optional(),
  directed: z.boolean().nullable().optional(),
  weight: z.number().finite().nullable().optional(),
})

const commandSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('add-report-comparison'),
    comparison: reportComparisonSchema,
  }),
  z.object({
    type: z.literal('remove-report-comparison'),
    comparisonId: z.string().min(1),
  }),
  z.object({
    type: z.literal('add-student'),
    student: z.object({
      id: z.string().min(1),
      displayName: z.string().optional(),
      tags: z.array(z.string()).optional(),
      notes: z.string().optional(),
    }),
  }),
  z.object({
    type: z.literal('update-student'),
    studentId: z.string().min(1),
    patch: z.object({
      displayName: z.string().nullable().optional(),
      tags: z.array(z.string()).optional(),
      notes: z.string().nullable().optional(),
    }),
  }),
  z.object({
    type: z.literal('remove-student'),
    studentId: z.string().min(1),
  }),
  z.object({
    type: z.literal('add-relationship'),
    relationship: relationshipSchema,
  }),
  z.object({
    type: z.literal('update-relationship'),
    relationshipId: z.string().min(1),
    patch: relationshipPatchSchema,
  }),
  z.object({
    type: z.literal('remove-relationship'),
    relationshipId: z.string().min(1),
  }),
  z.object({
    type: z.literal('add-metric-definition'),
    definition: metricDefinitionSchema,
  }),
  z.object({
    type: z.literal('remove-metric-definition'),
    metricKey: z.string().min(1),
  }),
  z.object({
    type: z.literal('set-metric-value'),
    studentId: z.string().min(1),
    metricKey: z.string().min(1),
    value: metricValueSchema,
  }),
  z.object({
    type: z.literal('unset-metric-value'),
    studentId: z.string().min(1),
    metricKey: z.string().min(1),
  }),
  z.object({
    type: z.literal('set-grid-room'),
    rows: z.number().int().positive(),
    columns: z.number().int().positive(),
    front: z.enum(['top', 'bottom', 'left', 'right']).optional(),
  }),
  z.object({
    type: z.literal('set-seat-enabled'),
    seatId: z.string().min(1),
    enabled: z.boolean(),
  }),
  z.object({
    type: z.literal('set-seat-tags'),
    seatId: z.string().min(1),
    tags: z.array(z.string()),
  }),
  z.object({
    type: z.literal('set-room-front'),
    front: z.enum(['top', 'bottom', 'left', 'right']),
  }),
  z.object({
    type: z.literal('set-planning-seed'),
    seed: z.string().min(1),
  }),
  z.object({
    type: z.literal('set-seat-assignment'),
    studentId: z.string().min(1),
    seatId: z.string().min(1),
    locked: z.boolean().optional(),
  }),
  z.object({
    type: z.literal('unassign-student'),
    studentId: z.string().min(1),
  }),
  z.object({
    type: z.literal('set-assignment-locked'),
    studentId: z.string().min(1),
    locked: z.boolean(),
  }),
  z.object({
    type: z.literal('replace-seat-assignments'),
    assignments: z.array(planningAssignmentSchema),
    source: z.enum(['manual-seat-assignment', 'accepted-seating-candidate']),
  }),
  z.object({
    type: z.literal('add-planning-rule'),
    rule: planningRuleSchema,
  }),
  z.object({
    type: z.literal('remove-planning-rule'),
    ruleId: z.string().min(1),
  }),
  z.object({
    type: z.literal('replace-planning-groups'),
    groups: z.array(planningGroupSchema),
    source: z.enum(['manual-grouping', 'accepted-grouping-candidate']),
  }),
  z.object({
    type: z.literal('set-group-student-locked'),
    groupId: z.string().min(1),
    studentId: z.string().min(1),
    locked: z.boolean(),
  }),
  z.object({
    type: z.literal('record-seating-history'),
    label: z.string().optional(),
    neighbourMode: z.enum(['orthogonal', 'king']),
  }),
  z.object({
    type: z.literal('remove-seating-history'),
    historyId: z.string().min(1),
  }),
  z.object({
    type: z.literal('save-planning-scenario'),
    label: z.string().min(1),
  }),
  z.object({
    type: z.literal('remove-planning-scenario'),
    scenarioId: z.string().min(1),
  }),
])

export type ProjectMutationCommand = z.infer<typeof commandSchema>

export interface ProjectMutationRequest {
  project: ClassGraphProject
  command: ProjectMutationCommand
}

export function parseProjectMutationRequest(value: unknown): ProjectMutationRequest {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('CG-1001 mutation request must be a JSON object')
  }

  const record = value as Record<string, unknown>
  const projectResult = classGraphProjectSchema.safeParse(record.project)
  if (!projectResult.success) {
    const issue = projectResult.error.issues[0]
    throw new Error(
      `CG-1001 invalid project in mutation request: ${issue?.message ?? 'validation failed'}`,
    )
  }

  const commandResult = commandSchema.safeParse(record.command)
  if (!commandResult.success) {
    const issue = commandResult.error.issues[0]
    throw new Error(`CG-1001 invalid mutation command: ${issue?.message ?? 'validation failed'}`)
  }

  return {
    project: projectResult.data,
    command: commandResult.data,
  }
}

export function applyProjectMutation(
  project: ClassGraphProject,
  command: ProjectMutationCommand,
  now: string,
): ClassGraphProject {
  switch (command.type) {
    case 'add-student':
      return addStudent(project, command.student, now)
    case 'update-student':
      return updateStudent(project, command.studentId, command.patch, now)
    case 'remove-student':
      return removeStudent(project, command.studentId, now)
    case 'add-relationship':
      return addRelationship(project, command.relationship, now)
    case 'update-relationship':
      return updateRelationship(project, command.relationshipId, command.patch, now)
    case 'remove-relationship':
      return removeRelationship(project, command.relationshipId, now)
    case 'add-metric-definition':
      return addMetricDefinition(project, command.definition, now)
    case 'remove-metric-definition':
      return removeMetricDefinition(project, command.metricKey, now)
    case 'set-metric-value':
      return setStudentMetricValue(
        project,
        command.studentId,
        command.metricKey,
        command.value,
        now,
      )
    case 'unset-metric-value':
      return unsetStudentMetricValue(project, command.studentId, command.metricKey, now)
    case 'set-grid-room':
      return setGridRoom(project, command.rows, command.columns, now, command.front)
    case 'set-seat-enabled':
      return setSeatEnabled(project, command.seatId, command.enabled, now)
    case 'set-seat-tags':
      return setSeatTags(project, command.seatId, command.tags, now)
    case 'set-room-front':
      return setRoomFront(project, command.front, now)
    case 'set-planning-seed':
      return setPlanningSeed(project, command.seed, now)
    case 'set-seat-assignment':
      return assignStudentToSeat(
        project,
        command.studentId,
        command.seatId,
        command.locked ?? false,
        now,
      )
    case 'unassign-student':
      return unassignStudentFromSeat(project, command.studentId, now)
    case 'set-assignment-locked':
      return setSeatAssignmentLocked(project, command.studentId, command.locked, now)
    case 'replace-seat-assignments':
      return replaceSeatAssignments(project, command.assignments, command.source, now)
    case 'add-planning-rule':
      return addPlanningRule(project, command.rule, now)
    case 'remove-planning-rule':
      return removePlanningRule(project, command.ruleId, now)
    case 'replace-planning-groups':
      return replacePlanningGroups(project, command.groups, command.source, now)
    case 'set-group-student-locked':
      return setGroupStudentLocked(project, command.groupId, command.studentId, command.locked, now)
    case 'record-seating-history':
      return recordApprovedSeatingHistory(
        project,
        { label: command.label, neighbourMode: command.neighbourMode },
        now,
      )
    case 'remove-seating-history':
      return removeApprovedSeatingHistory(project, command.historyId, now)
    case 'save-planning-scenario':
      return savePlanningScenario(project, command.label, now)
    case 'remove-planning-scenario':
      return removePlanningScenario(project, command.scenarioId, now)
    case 'add-report-comparison':
      return addReportComparison(project, command.comparison, now)
    case 'remove-report-comparison':
      return removeReportComparison(project, command.comparisonId, now)
  }
}
