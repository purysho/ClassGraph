import { z } from 'zod'
import { buildAnalysisExport } from './export-json.js'
import type {
  ClassGraphProject,
  PlanningGroup,
  PlanningRule,
  ProvenanceEntry,
  RoomDefinition,
} from './model.js'
import { classGraphProjectSchema } from './schema.js'

const provenanceEntrySchema = z.object({
  kind: z.enum(['observed', 'teacher-entered', 'imported', 'derived', 'synthetic']),
  source: z.string().optional(),
  note: z.string().optional(),
  derivedFrom: z.array(z.string()).optional(),
})

const sourceFieldValueSchema = z.object({
  path: z.string().min(1),
  kind: z.enum(['observed', 'teacher-entered', 'imported']),
  value: z.unknown(),
})

const seatAssignmentSchema = z.object({
  studentId: z.string().min(1),
  seatId: z.string().min(1),
  row: z.number().int().nonnegative(),
  col: z.number().int().nonnegative(),
  locked: z.boolean(),
})

const unmappedSeatAssignmentSchema = z.object({
  studentId: z.string().min(1),
  seatId: z.string().min(1),
  locked: z.boolean(),
  reason: z.literal('seat-has-no-grid-coordinate'),
})

export const eduBoardHandbackSchema = z.object({
  format: z.literal('classgraph-eduboard-handback'),
  version: z.literal('1.0'),
  project: z.object({
    schemaVersion: z.literal('1.0'),
    projectId: z.string().min(1),
    title: z.string(),
    updatedAt: z.string(),
  }),
  compatibility: z.object({
    targetApplication: z.literal('EduBoard'),
    targetContractVersion: z.literal('1'),
    requiresExplicitClassSelection: z.literal(true),
    studentIdMapping: z.literal('exact-id-only'),
    seatCoordinates: z.literal('zero-based-row-col'),
  }),
  sourceData: z.object({
    studentReferences: z.array(
      z.object({
        studentId: z.string().min(1),
        displayName: z.string().optional(),
      }),
    ),
    sourceFieldValues: z.array(sourceFieldValueSchema),
  }),
  derivedAnalysis: z.unknown(),
  approvedPlanning: z.object({
    room: z.unknown().nullable(),
    seed: z.string().optional(),
    seatAssignments: z.array(seatAssignmentSchema),
    unmappedSeatAssignments: z.array(unmappedSeatAssignmentSchema),
    groups: z.array(z.unknown()),
    rules: z.array(z.unknown()),
    approvedCandidateId: z.string().optional(),
  }),
  syntheticPaths: z.array(z.string()),
  derivedPaths: z.array(z.string()),
  provenance: z.record(z.string(), provenanceEntrySchema),
  extensions: z.record(z.string(), z.unknown()).optional(),
})

export type EduBoardHandbackV1 = z.infer<typeof eduBoardHandbackSchema>

function decodePointerSegment(segment: string): string {
  return segment.replace(/~1/g, '/').replace(/~0/g, '~')
}

function readPointer(root: unknown, path: string): unknown {
  if (!path.startsWith('/')) return undefined
  let current: unknown = root

  for (const rawSegment of path.slice(1).split('/')) {
    const segment = decodePointerSegment(rawSegment)
    if (Array.isArray(current)) {
      if (!/^\d+$/.test(segment)) return undefined
      current = current[Number(segment)]
      continue
    }
    if (typeof current !== 'object' || current === null) return undefined
    current = (current as Record<string, unknown>)[segment]
  }

  return current
}

function sourceFieldValues(
  project: ClassGraphProject,
): EduBoardHandbackV1['sourceData']['sourceFieldValues'] {
  const allowed = new Set<ProvenanceEntry['kind']>(['observed', 'teacher-entered', 'imported'])
  return Object.entries(project.provenance)
    .filter(
      ([path, entry]) =>
        allowed.has(entry.kind) && !path.startsWith('/planning') && !path.startsWith('/room'),
    )
    .sort(([left], [right]) => left.localeCompare(right))
    .flatMap(([path, entry]) => {
      const value = readPointer(project, path)
      if (value === undefined) return []
      return [{ path, kind: entry.kind as 'observed' | 'teacher-entered' | 'imported', value }]
    })
}

function planningForEduBoard(project: ClassGraphProject): {
  room: RoomDefinition | null
  seed?: string
  seatAssignments: EduBoardHandbackV1['approvedPlanning']['seatAssignments']
  unmappedSeatAssignments: EduBoardHandbackV1['approvedPlanning']['unmappedSeatAssignments']
  groups: PlanningGroup[]
  rules: PlanningRule[]
  approvedCandidateId?: string
} {
  const seats = new Map((project.room?.seats ?? []).map((seat) => [seat.id, seat]))
  const seatAssignments: EduBoardHandbackV1['approvedPlanning']['seatAssignments'] = []
  const unmappedSeatAssignments: EduBoardHandbackV1['approvedPlanning']['unmappedSeatAssignments'] =
    []

  for (const assignment of project.planning?.assignments ?? []) {
    const seat = seats.get(assignment.seatId)
    if (seat?.row !== undefined && seat.column !== undefined) {
      seatAssignments.push({
        studentId: assignment.studentId,
        seatId: assignment.seatId,
        row: seat.row,
        col: seat.column,
        locked: assignment.locked,
      })
    } else {
      unmappedSeatAssignments.push({
        studentId: assignment.studentId,
        seatId: assignment.seatId,
        locked: assignment.locked,
        reason: 'seat-has-no-grid-coordinate',
      })
    }
  }

  const planning = project.planning
  return {
    room: project.room ? structuredClone(project.room) : null,
    ...(planning?.seed ? { seed: planning.seed } : {}),
    seatAssignments,
    unmappedSeatAssignments,
    groups: structuredClone(planning?.groups ?? []),
    rules: structuredClone(planning?.rules ?? []),
    ...(planning?.approvedCandidateId ? { approvedCandidateId: planning.approvedCandidateId } : {}),
  }
}

function provenancePaths(project: ClassGraphProject, kind: ProvenanceEntry['kind']): string[] {
  return Object.entries(project.provenance)
    .filter(([, entry]) => entry.kind === kind)
    .map(([path]) => path)
    .sort()
}

export function buildEduBoardHandback(project: ClassGraphProject): EduBoardHandbackV1 {
  const validated = classGraphProjectSchema.parse(project)
  const analysis = buildAnalysisExport(validated)

  const handback: EduBoardHandbackV1 = {
    format: 'classgraph-eduboard-handback',
    version: '1.0',
    project: {
      schemaVersion: validated.schemaVersion,
      projectId: validated.projectId,
      title: validated.title,
      updatedAt: validated.updatedAt,
    },
    compatibility: {
      targetApplication: 'EduBoard',
      targetContractVersion: '1',
      requiresExplicitClassSelection: true,
      studentIdMapping: 'exact-id-only',
      seatCoordinates: 'zero-based-row-col',
    },
    sourceData: {
      studentReferences: validated.students.map((student) => ({
        studentId: student.id,
        ...(student.displayName ? { displayName: student.displayName } : {}),
      })),
      sourceFieldValues: sourceFieldValues(validated),
    },
    derivedAnalysis: analysis.analysis,
    approvedPlanning: planningForEduBoard(validated),
    syntheticPaths: provenancePaths(validated, 'synthetic'),
    derivedPaths: provenancePaths(validated, 'derived'),
    provenance: structuredClone(validated.provenance),
    ...(validated.extensions ? { extensions: structuredClone(validated.extensions) } : {}),
  }

  return eduBoardHandbackSchema.parse(handback)
}

export function serializeEduBoardHandback(project: ClassGraphProject): string {
  return `${JSON.stringify(buildEduBoardHandback(project), null, 2)}\n`
}

export function parseEduBoardHandbackJson(input: string): EduBoardHandbackV1 {
  let raw: unknown
  try {
    raw = JSON.parse(input) as unknown
  } catch {
    throw new Error('CG-5005 EduBoard hand-back file is not valid JSON')
  }
  const result = eduBoardHandbackSchema.safeParse(raw)
  if (!result.success) {
    const issue = result.error.issues[0]
    throw new Error(
      `CG-5006 EduBoard hand-back v1 is invalid${issue?.path.length ? ` at ${issue.path.join('.')}` : ''}: ${issue?.message ?? 'validation failed'}`,
    )
  }
  return result.data
}
