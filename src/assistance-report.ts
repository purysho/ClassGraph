import type {
  ReportWordingDraftProposal,
} from './assistance-contract.js'
import type { ReportSnapshot } from './report-model.js'

function provenanceSentence(snapshot: ReportSnapshot): string {
  const p = snapshot.provenanceSummary
  return [
    `${p.observed} observed`,
    `${p['teacher-entered']} teacher-entered`,
    `${p.imported} imported`,
    `${p.derived} derived`,
    `${p.synthetic} synthetic`,
  ].join(', ')
}

export function draftReportWording(
  snapshot: ReportSnapshot,
  requestId: string,
  providerLabel?: string,
): ReportWordingDraftProposal {
  const planning = snapshot.planning
  const assignmentCount = planning?.assignments?.length ?? 0
  const groupCount = planning?.groups?.length ?? 0
  const ruleCount = planning?.rules?.length ?? 0
  const c = snapshot.analysis.completeness

  return {
    version: '1.0',
    proposalId: `proposal-${requestId}`,
    requestId,
    task: 'report-wording-draft',
    status: 'proposal',
    ...(providerLabel ? { providerLabel } : {}),
    warnings: [
      'Draft wording is not part of canonical project data. Review or copy it explicitly before use.',
    ],
    assumptions: [],
    sections: [
      {
        heading: 'Class overview',
        text: `${snapshot.project.title} contains ${snapshot.analysis.studentCount} student(s) and ${snapshot.analysis.metricCount} defined metric(s). This wording summarizes the validated ClassGraph report snapshot only.`,
      },
      {
        heading: 'Data and provenance',
        text: `The snapshot contains ${c.recordedCount} recorded metric cell(s), ${c.explicitMissingCount} explicitly missing cell(s), and ${c.unrecordedCount} not-recorded cell(s). Provenance entries are ${provenanceSentence(snapshot)}. Missing values are not imputed.`,
      },
      {
        heading: 'Planning',
        text: `The stored planning state contains ${assignmentCount} seating assignment(s), ${groupCount} group(s), and ${ruleCount} explicit planning rule(s). These are planning records, not predictions of student outcomes.`,
      },
      {
        heading: 'Limitations',
        text: snapshot.limitations.join(' '),
      },
    ],
  }
}
