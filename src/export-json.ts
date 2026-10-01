import type { ClassGraphProject, FieldProvenanceMap } from './model.js'
import {
  buildReportSnapshot,
  type ProvenanceSummary,
  type ReportStudentRef,
} from './report-model.js'
import { classGraphProjectSchema } from './schema.js'

export interface AnalysisExportV1 {
  format: 'classgraph-analysis'
  version: '1.0'
  project: {
    schemaVersion: '1.0'
    projectId: string
    title: string
    updatedAt: string
  }
  analysis: ReturnType<typeof buildReportSnapshot>['analysis']
  provenanceSummary: ProvenanceSummary
  syntheticPaths: string[]
  limitations: string[]
}

export interface SeatingPlanExportV1 {
  format: 'classgraph-seating-plan'
  version: '1.0'
  project: {
    schemaVersion: '1.0'
    projectId: string
    title: string
    updatedAt: string
  }
  students: ReportStudentRef[]
  room: NonNullable<ClassGraphProject['room']> | null
  approvedPlanning: {
    seed?: string
    assignments: NonNullable<NonNullable<ClassGraphProject['planning']>['assignments']>
    rules: NonNullable<NonNullable<ClassGraphProject['planning']>['rules']>
    groups: NonNullable<NonNullable<ClassGraphProject['planning']>['groups']>
    approvedCandidateId?: string
  }
  planningProvenance: FieldProvenanceMap
  limitations: string[]
}

const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i

export function safeExportStem(title: string, fallback = 'classgraph'): string {
  let value = title
    .normalize('NFKC')
    .replace(/[<>:"/\\|?*\u0000-\u001f\u007f]/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/-+/g, '-')
    .trim()
    .replace(/[. ]+$/g, '')

  if (!value) value = fallback
  if (WINDOWS_RESERVED.test(value)) value = `${fallback}-${value}`

  const codePoints = [...value]
  if (codePoints.length > 80) value = codePoints.slice(0, 80).join('').replace(/[. ]+$/g, '')
  return value || fallback
}

function serializeStable(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`
}

function projectIdentity(project: ClassGraphProject): AnalysisExportV1['project'] {
  return {
    schemaVersion: project.schemaVersion,
    projectId: project.projectId,
    title: project.title,
    updatedAt: project.updatedAt,
  }
}

function planningProvenance(project: ClassGraphProject): FieldProvenanceMap {
  return Object.fromEntries(
    Object.entries(project.provenance)
      .filter(([path]) => path === '/room' || path.startsWith('/room/') || path.startsWith('/planning/'))
      .sort(([left], [right]) => left.localeCompare(right)),
  )
}

export function buildAnalysisExport(project: ClassGraphProject): AnalysisExportV1 {
  const validated = classGraphProjectSchema.parse(project)
  const snapshot = buildReportSnapshot(validated)

  return {
    format: 'classgraph-analysis',
    version: '1.0',
    project: projectIdentity(validated),
    analysis: snapshot.analysis,
    provenanceSummary: snapshot.provenanceSummary,
    syntheticPaths: snapshot.syntheticPaths,
    limitations: snapshot.limitations,
  }
}

export function buildSeatingPlanExport(project: ClassGraphProject): SeatingPlanExportV1 {
  const validated = classGraphProjectSchema.parse(project)
  const snapshot = buildReportSnapshot(validated)
  const planning = validated.planning

  return {
    format: 'classgraph-seating-plan',
    version: '1.0',
    project: projectIdentity(validated),
    students: snapshot.roster,
    room: validated.room ? structuredClone(validated.room) : null,
    approvedPlanning: {
      ...(planning?.seed ? { seed: planning.seed } : {}),
      assignments: structuredClone(planning?.assignments ?? []),
      rules: structuredClone(planning?.rules ?? []),
      groups: structuredClone(planning?.groups ?? []),
      ...(planning?.approvedCandidateId
        ? { approvedCandidateId: planning.approvedCandidateId }
        : {}),
    },
    planningProvenance: planningProvenance(validated),
    limitations: snapshot.limitations,
  }
}

export function serializeAnalysisExport(project: ClassGraphProject): string {
  return serializeStable(buildAnalysisExport(project))
}

export function serializeSeatingPlanExport(project: ClassGraphProject): string {
  return serializeStable(buildSeatingPlanExport(project))
}
