import { buildProjectAnalysis, type ProjectAnalysisView } from './analysis-view.js'
import type {
  ClassGraphProject,
  PlanningConfiguration,
  RoomDefinition,
  StudentRecord,
} from './model.js'
import { classGraphProjectSchema } from './schema.js'

export interface ProvenanceSummary {
  observed: number
  'teacher-entered': number
  imported: number
  derived: number
  synthetic: number
  total: number
}

export interface ReportStudentRef {
  id: string
  displayName?: string
}

export interface ReportSnapshot {
  format: 'classgraph-report-snapshot'
  version: '1.0'
  project: {
    schemaVersion: '1.0'
    projectId: string
    title: string
    createdAt: string
    updatedAt: string
    classInfo: ClassGraphProject['classInfo']
  }
  roster: ReportStudentRef[]
  analysis: ProjectAnalysisView
  room?: RoomDefinition
  planning?: PlanningConfiguration
  provenanceSummary: ProvenanceSummary
  syntheticPaths: string[]
  limitations: string[]
}

function emptyProvenanceSummary(): ProvenanceSummary {
  return {
    observed: 0,
    'teacher-entered': 0,
    imported: 0,
    derived: 0,
    synthetic: 0,
    total: 0,
  }
}

export function summarizeProvenance(project: ClassGraphProject): ProvenanceSummary {
  const summary = emptyProvenanceSummary()

  for (const entry of Object.values(project.provenance)) {
    summary[entry.kind] += 1
    summary.total += 1
  }

  return summary
}

export function syntheticProvenancePaths(project: ClassGraphProject): string[] {
  return Object.entries(project.provenance)
    .filter(([, entry]) => entry.kind === 'synthetic')
    .map(([path]) => path)
    .sort()
}

function reportRoster(students: StudentRecord[]): ReportStudentRef[] {
  return students.map((student) => ({
    id: student.id,
    ...(student.displayName ? { displayName: student.displayName } : {}),
  }))
}

export function buildReportLimitations(
  project: ClassGraphProject,
  analysis: ProjectAnalysisView,
): string[] {
  const limitations: string[] = []

  if (analysis.completeness.explicitMissingCount > 0) {
    limitations.push(
      `${analysis.completeness.explicitMissingCount} metric cell(s) are explicitly recorded as missing and are not imputed.`,
    )
  }
  if (analysis.completeness.unrecordedCount > 0) {
    limitations.push(
      `${analysis.completeness.unrecordedCount} metric cell(s) are not recorded and are not imputed.`,
    )
  }

  const syntheticCount = syntheticProvenancePaths(project).length
  if (syntheticCount > 0) {
    limitations.push(
      `${syntheticCount} provenance path(s) are marked synthetic; synthetic content is not observed student data.`,
    )
  }

  if (!project.room) {
    limitations.push('No classroom room definition is stored in this project.')
  }

  const assignmentCount = project.planning?.assignments?.length ?? 0
  if (assignmentCount === 0) {
    limitations.push('No approved/persisted seating assignments are stored in this project.')
  } else if (assignmentCount < project.students.length) {
    limitations.push(
      `Persisted seating covers ${assignmentCount} of ${project.students.length} student(s); unassigned students remain unassigned.`,
    )
  }

  if ((project.planning?.groups?.length ?? 0) === 0) {
    limitations.push('No approved/persisted grouping plan is stored in this project.')
  }

  limitations.push(
    'ClassGraph analysis is descriptive and planning output does not predict attainment or guarantee educational outcomes.',
  )

  return limitations
}

export function buildReportSnapshot(project: ClassGraphProject): ReportSnapshot {
  const validated = classGraphProjectSchema.parse(project)
  const analysis = buildProjectAnalysis(validated)

  return {
    format: 'classgraph-report-snapshot',
    version: '1.0',
    project: {
      schemaVersion: validated.schemaVersion,
      projectId: validated.projectId,
      title: validated.title,
      createdAt: validated.createdAt,
      updatedAt: validated.updatedAt,
      classInfo: structuredClone(validated.classInfo),
    },
    roster: reportRoster(validated.students),
    analysis,
    ...(validated.room ? { room: structuredClone(validated.room) } : {}),
    ...(validated.planning ? { planning: structuredClone(validated.planning) } : {}),
    provenanceSummary: summarizeProvenance(validated),
    syntheticPaths: syntheticProvenancePaths(validated),
    limitations: buildReportLimitations(validated, analysis),
  }
}
