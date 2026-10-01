import { describe, expect, it } from 'vitest'
import {
  draftAnalysisExplanation,
  draftPlanningRuleSuggestions,
  draftReportWording,
  draftSyntheticSpecFromPrompt,
} from '../src/assistance-offline.js'
import { createEmptyProject } from '../src/workspace.js'
import { addRelationship } from '../src/relationships.js'

describe('offline assistance drafts', () => {
  it('turns constrained teacher language into an editable synthetic specification without generating students', () => {
    const proposal = draftSyntheticSpecFromPrompt({
      requestId: 'request-1',
      prompt: 'Make 36 students with assessment scores around 72, SD 10, and participation.',
    })

    expect(proposal.status).toBe('proposal')
    expect(proposal.specification).toMatchObject({
      studentCount: 36,
      metricDefinitions: [
        { key: 'assessment', kind: 'number' },
        { key: 'participation', kind: 'ordinal' },
      ],
    })
    expect(proposal.specification).not.toHaveProperty('students')
    expect(proposal.assumptions.some((item) => item.includes('Participation'))).toBe(true)
  })

  it('supports explicit numeric and category metric syntax while leaving the result editable', () => {
    const proposal = draftSyntheticSpecFromPrompt({
      requestId: 'request-2',
      prompt:
        '24 learners; metric fluency from 0 to 20 around 12; confidence categories: low, medium, high.',
    })

    expect(proposal.specification).toMatchObject({
      studentCount: 24,
      metricDefinitions: [
        { key: 'fluency', kind: 'number' },
        { key: 'confidence', kind: 'category' },
      ],
    })
  })

  it('warns when a prompt is structurally valid but no supported metric rule is recognised', () => {
    const proposal = draftSyntheticSpecFromPrompt({
      requestId: 'request-3',
      prompt: 'Create 28 students for a blank synthetic roster.',
    })

    expect(proposal.specification.metricDefinitions).toEqual([])
    expect(proposal.warnings[0]).toContain('No supported metric pattern')
  })

  it('rejects requests to invent hidden traits, diagnoses, or predictions', () => {
    expect(() =>
      draftSyntheticSpecFromPrompt({
        requestId: 'request-4',
        prompt: 'Create 30 students and predict future attainment and motivation.',
      }),
    ).toThrow('CG-6102')
  })

  it('explains only existing descriptive analysis and includes missing-data/causation caveats', () => {
    const project = createEmptyProject({
      projectId: 'analysis',
      title: 'Analysis',
      now: '2026-10-02T00:00:00.000Z',
    })
    project.metricDefinitions = [{ key: 'score', label: 'Score', kind: 'number' }]
    project.students = [
      { id: 's1', metrics: { score: 60 } },
      { id: 's2', metrics: { score: null } },
      { id: 's3', metrics: {} },
    ]

    const proposal = draftAnalysisExplanation('request-analysis', project)

    expect(proposal.text).toContain('Score:')
    expect(proposal.text).toContain('mean 60')
    expect(proposal.caveats.join(' ')).toContain('does not establish causation')
    expect(proposal.caveats.join(' ')).toContain('not recorded')
    expect(proposal.sourceMetricKeys).toEqual(['score'])
  })

  it('drafts report wording from the canonical snapshot while preserving limitations', () => {
    const project = createEmptyProject({
      projectId: 'report',
      title: 'Report Draft',
      now: '2026-10-02T00:00:00.000Z',
    })

    const proposal = draftReportWording('request-report', project)

    expect(proposal.status).toBe('proposal')
    expect(proposal.sections.map((section) => section.heading)).toEqual([
      'Class overview',
      'Data quality and provenance',
      'Planning',
      'Limitations',
    ])
    expect(proposal.sections.at(-1)?.text).toContain('descriptive')
  })

  it('suggests rules only from explicit relationships and skips friendship/custom edges', () => {
    let project = createEmptyProject({
      projectId: 'rules',
      title: 'Rules',
      now: '2026-10-02T00:00:00.000Z',
    })
    project.students = [
      { id: 's1', metrics: {} },
      { id: 's2', metrics: {} },
      { id: 's3', metrics: {} },
    ]
    project = addRelationship(
      project,
      {
        id: 'r1',
        fromStudentId: 's1',
        toStudentId: 's2',
        type: 'avoid-pairing',
      },
      'teacher-entered',
    )
    project = addRelationship(
      project,
      {
        id: 'r2',
        fromStudentId: 's2',
        toStudentId: 's3',
        type: 'friendship',
      },
      'teacher-entered',
    )

    const proposal = draftPlanningRuleSuggestions('request-rules', project)

    expect(proposal.suggestions).toHaveLength(1)
    expect(proposal.suggestions[0]?.rule).toMatchObject({
      strength: 'soft',
      kind: 'prefer-apart',
      studentAId: 's1',
      studentBId: 's2',
    })
    expect(proposal.suggestions[0]?.inputPaths).toEqual(['/relationships/0'])
    expect(proposal.warnings.join(' ')).toContain('not converted')
  })
})
