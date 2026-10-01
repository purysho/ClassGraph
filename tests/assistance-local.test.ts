import { describe, expect, it } from 'vitest'
import { buildProjectAnalysis } from '../src/analysis-view.js'
import {
  acceptPlanningRuleSuggestions,
  acceptSyntheticSpecDraft,
} from '../src/assistance-acceptance.js'
import { draftAnalysisExplanation } from '../src/assistance-analysis.js'
import { draftPlanningRuleSuggestions } from '../src/assistance-planning.js'
import { draftReportWording } from '../src/assistance-report.js'
import { draftSyntheticSpecProposal } from '../src/assistance-synthetic.js'
import { buildReportSnapshot } from '../src/report-model.js'
import type { ClassGraphProject } from '../src/model.js'
import { createEmptyProject } from '../src/workspace.js'

function projectFixture(): ClassGraphProject {
  const base = createEmptyProject({
    projectId: 'assist-class',
    title: 'Assistance Class',
    now: '2026-10-02T01:00:00.000Z',
  })
  return {
    ...base,
    metricDefinitions: [
      {
        key: 'score',
        label: 'Score',
        kind: 'number',
        numberScale: { min: 0, max: 100 },
      },
    ],
    students: [
      { id: 's1', displayName: 'One', metrics: { score: 80 } },
      { id: 's2', displayName: 'Two', metrics: { score: null } },
      { id: 's3', displayName: 'Three', metrics: {} },
    ],
    relationships: [
      {
        id: 'r-apart',
        fromStudentId: 's1',
        toStudentId: 's2',
        type: 'avoid-pairing',
      },
      {
        id: 'r-friend',
        fromStudentId: 's2',
        toStudentId: 's3',
        type: 'friendship',
      },
    ],
    provenance: {
      ...base.provenance,
      '/students/0/metrics/score': { kind: 'teacher-entered' },
      '/students/1/metrics/score': { kind: 'teacher-entered' },
      '/relationships/0': { kind: 'teacher-entered' },
      '/relationships/1': { kind: 'teacher-entered' },
    },
  }
}

describe('local assistance drafts', () => {
  it('turns explicit teacher synthetic intent into an editable structured proposal without generating students', () => {
    const proposal = draftSyntheticSpecProposal({
      requestId: 'synthetic-1',
      projectId: 'draft-class',
      title: 'Draft class',
      seed: 'teacher-seed',
      prompt:
        '36 students; metric Assessment mean 70 sd 10 range 0-100 missing 5%; metric Participation ordinal 1:1, 2:2, 3:4, 4:2, 5:1 missing 5%',
    })

    expect(proposal.status).toBe('proposal')
    expect(proposal.specification).toMatchObject({
      studentCount: 36,
      seed: 'teacher-seed',
    })

    const accepted = acceptSyntheticSpecDraft(proposal)
    expect(accepted.metrics).toHaveLength(2)
    expect(accepted).not.toHaveProperty('students')
  })

  it('skips hidden-trait requests and keeps ambiguous drafts editable instead of inventing data', () => {
    const proposal = draftSyntheticSpecProposal({
      requestId: 'synthetic-2',
      projectId: 'draft-class',
      prompt:
        '30 students; metric Motivation categories low, medium, high; make the rest realistic',
    })

    const accepted = acceptSyntheticSpecDraft(proposal)
    expect(accepted.studentCount).toBe(30)
    expect(accepted.metrics).toEqual([])
    expect(proposal.warnings.join(' ')).toMatch(/motivation/i)
    expect(proposal.warnings.join(' ')).toMatch(/No supported metric clauses/i)
  })

  it('explains only descriptive analysis and always keeps missingness and causation caveats explicit', () => {
    const analysis = buildProjectAnalysis(projectFixture())
    const proposal = draftAnalysisExplanation(analysis, 'analysis-1')

    expect(proposal.sourceMetricKeys).toEqual(['score'])
    expect(proposal.text).toContain('explicitly missing')
    expect(proposal.caveats.join(' ')).toMatch(/not imputed/i)
    expect(proposal.caveats.join(' ')).toMatch(/do not establish causation/i)
    expect(proposal.text).not.toMatch(/because|caused by/i)
  })

  it('drafts report wording from the canonical snapshot and preserves its limitations', () => {
    const snapshot = buildReportSnapshot(projectFixture())
    const proposal = draftReportWording(snapshot, 'report-1')
    const limitations = proposal.sections.find((section) => section.heading === 'Limitations')

    expect(proposal.status).toBe('proposal')
    expect(limitations?.text).toBe(snapshot.limitations.join(' '))
    expect(proposal.warnings.join(' ')).toMatch(/not part of canonical project data/i)
  })

  it('suggests only explicit supported relationship-derived soft rules and never invents from friendship or metrics', () => {
    const project = projectFixture()
    const proposal = draftPlanningRuleSuggestions(project, 'planning-1')

    expect(proposal.suggestions).toHaveLength(1)
    expect(proposal.suggestions[0]).toMatchObject({
      rule: {
        strength: 'soft',
        kind: 'prefer-apart',
        studentAId: 's1',
        studentBId: 's2',
      },
      inputPaths: ['/relationships/0'],
    })
    expect(proposal.warnings.join(' ')).toMatch(/friendship/i)

    const before = structuredClone(project)
    const accepted = acceptPlanningRuleSuggestions(proposal, [0])
    expect(accepted).toHaveLength(1)
    expect(project).toEqual(before)
  })
})
