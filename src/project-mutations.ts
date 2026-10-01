import { z } from 'zod'
import type { ClassGraphProject, MetricDefinition, MetricValue, StudentPatch } from './model.js'
import {
  addMetricDefinition,
  removeMetricDefinition,
  setStudentMetricValue,
  unsetStudentMetricValue,
} from './metrics.js'
import { classGraphProjectSchema } from './schema.js'
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

const commandSchema = z.discriminatedUnion('type', [
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
    throw new Error(
      `CG-1001 invalid mutation command: ${issue?.message ?? 'validation failed'}`,
    )
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
      return updateStudent(project, command.studentId, command.patch as StudentPatch, now)
    case 'remove-student':
      return removeStudent(project, command.studentId, now)
    case 'add-metric-definition':
      return addMetricDefinition(project, command.definition as MetricDefinition, now)
    case 'remove-metric-definition':
      return removeMetricDefinition(project, command.metricKey, now)
    case 'set-metric-value':
      return setStudentMetricValue(
        project,
        command.studentId,
        command.metricKey,
        command.value as MetricValue,
        now,
      )
    case 'unset-metric-value':
      return unsetStudentMetricValue(project, command.studentId, command.metricKey, now)
  }
}
