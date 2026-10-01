import { describe, expect, it } from 'vitest'
import {
  buildAssistanceTransmissionPreview,
  parseAssistanceProposal,
  parseAssistanceRequestEnvelope,
} from '../src/assistance-contract.js'
import {
  acceptPlanningRuleSuggestions,
  acceptSyntheticSpecDraft,
} from '../src/assistance-acceptance.js'

describe('assistance contract', () => {
  it('marks network requests as requiring explicit send and summarizes disclosed context', () => {
    const preview = buildAssistanceTransmissionPreview(
      'network',
      [
        {
          id: 'analysis',
          label: 'Aggregate analysis',
          scope: 'aggregate-analysis',
          content: { studentCount: 30 },
          containsStudentIds: false,
          containsDisplayNames: false,
          containsFreeText: false,
          syntheticOnly: false,
        },
        {
          id: 'prompt',
          label: 'Teacher prompt',
          scope: 'teacher-prompt',
          content: 'Explain this distribution.',
          containsStudentIds: false,
          containsDisplayNames: false,
          containsFreeText: true,
          syntheticOnly: false,
        },
      ],
      'Example provider',
    )

    expect(preview).toMatchObject({
      mode: 'network',
      providerLabel: 'Example provider',
      containsStudentLevelData: false,
      containsRealStudentData: false,
      containsStudentIds: false,
      containsDisplayNames: false,
      containsFreeText: true,
      requiresExplicitSend: true,
    })
  })

  it('flags real student-level context distinctly from aggregate context', () => {
    const preview = buildAssistanceTransmissionPreview('network', [
      {
        id: 'students',
        label: 'Selected students',
        scope: 'student-level',
        content: [{ id: 's1', score: 80 }],
        containsStudentIds: true,
        containsDisplayNames: false,
        containsFreeText: false,
        syntheticOnly: false,
      },
    ], 'Example provider')

    expect(preview.containsStudentLevelData).toBe(true)
    expect(preview.containsRealStudentData).toBe(true)
    expect(preview.containsStudentIds).toBe(true)
  })

  it('rejects a network request that omits a provider label', () => {
    expect(() =>
      parseAssistanceRequestEnvelope({
        version: '1.0',
        requestId: 'request-1',
        task: 'analysis-explanation',
        disclosure: {
          mode: 'network',
          items: [],
          containsStudentLevelData: false,
          containsRealStudentData: false,
          containsStudentIds: false,
          containsDisplayNames: false,
          containsFreeText: false,
          requiresExplicitSend: true,
        },
        payload: {},
      }),
    ).toThrow('CG-6001')
  })

  it('requires all assistance outputs to remain proposal-labelled', () => {
    expect(() =>
      parseAssistanceProposal({
        version: '1.0',
        proposalId: 'proposal-1',
        requestId: 'request-1',
        task: 'analysis-explanation',
        status: 'applied',
        warnings: [],
        assumptions: [],
        text: 'Draft',
        sourceMetricKeys: [],
        caveats: [],
      }),
    ).toThrow('CG-6002')
  })
})

describe('assistance acceptance boundary', () => {
  it('validates a synthetic draft into the existing structured specification without generating students', () => {
    const accepted = acceptSyntheticSpecDraft({
      version: '1.0',
      proposalId: 'proposal-synthetic',
      requestId: 'request-synthetic',
      task: 'synthetic-spec-draft',
      status: 'proposal',
      warnings: ['Teacher should review the assumed spread.'],
      assumptions: ['Used a normal distribution because the prompt described clustering.'],
      specification: {
        projectId: 'synthetic-draft',
        title: 'Draft Class',
        studentCount: 36,
        seed: 'draft-seed',
        metricDefinitions: [
          {
            key: 'assessment',
            label: 'Assessment',
            kind: 'number',
            numberScale: { min: 0, max: 100 },
          },
        ],
        metrics: [
          {
            key: 'assessment',
            kind: 'number',
            distribution: {
              type: 'normal',
              mean: 70,
              standardDeviation: 10,
              min: 0,
              max: 100,
            },
          },
        ],
      },
    })

    expect(accepted).toMatchObject({
      projectId: 'synthetic-draft',
      studentCount: 36,
      seed: 'draft-seed',
    })
    expect(accepted).not.toHaveProperty('students')
  })

  it('returns only explicitly selected planning-rule suggestions and does not apply them', () => {
    const accepted = acceptPlanningRuleSuggestions(
      {
        version: '1.0',
        proposalId: 'proposal-rules',
        requestId: 'request-rules',
        task: 'planning-rule-suggestions',
        status: 'proposal',
        warnings: [],
        assumptions: [],
        suggestions: [
          {
            rule: {
              id: 'rule-1',
              strength: 'soft',
              kind: 'prefer-seat-tag',
              studentId: 's1',
              tag: 'front',
              weight: 1,
            },
            rationale: 'Uses the explicit teacher-selected front-seat preference.',
            inputPaths: ['/students/0', '/room/seats'],
          },
          {
            rule: {
              id: 'rule-2',
              strength: 'hard',
              kind: 'keep-apart',
              studentAId: 's1',
              studentBId: 's2',
            },
            rationale: 'Uses an explicit teacher-authored separation request.',
            inputPaths: ['/relationships/0'],
          },
        ],
      },
      [1],
    )

    expect(accepted).toHaveLength(1)
    expect(accepted[0]?.rule.id).toBe('rule-2')
    expect(accepted[0]?.rule.kind).toBe('keep-apart')
  })

  it('rejects invalid suggested rules at acceptance instead of trusting provider output', () => {
    expect(() =>
      acceptPlanningRuleSuggestions(
        {
          version: '1.0',
          proposalId: 'proposal-invalid-rule',
          requestId: 'request-invalid-rule',
          task: 'planning-rule-suggestions',
          status: 'proposal',
          warnings: [],
          assumptions: [],
          suggestions: [
            {
              rule: {
                id: 'bad-rule',
                strength: 'hard',
                kind: 'keep-apart',
                studentAId: '',
                studentBId: 's2',
              },
              rationale: 'Invalid fixture.',
              inputPaths: [],
            },
          ],
        },
        [0],
      ),
    ).toThrow('CG-6005')
  })
})
