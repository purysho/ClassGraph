import { describe, expect, it } from 'vitest'
import { addMetricDefinition, setStudentMetricValue } from '../src/metrics.js'
import { generateGroupingCandidates } from '../src/grouping.js'
import { replacePlanningGroups, setGroupStudentLocked } from '../src/planning-state.js'
import { addStudent, createEmptyProject } from '../src/workspace.js'

const t0 = '2026-10-01T10:00:00.000Z'

function baseProject() {
  let project = createEmptyProject({ projectId: 'groups', title: 'Groups', now: t0 })
  for (const id of ['s1', 's2', 's3', 's4', 's5', 's6']) {
    project = addStudent(project, { id }, t0)
  }
  return project
}

describe('grouping candidate engine', () => {
  it('is deterministic and returns multiple balanced candidates', () => {
    const first = generateGroupingCandidates(baseProject(), {
      groupCount: 3,
      seed: 'same',
      candidateCount: 3,
      attempts: 100,
    })
    const second = generateGroupingCandidates(baseProject(), {
      groupCount: 3,
      seed: 'same',
      candidateCount: 3,
      attempts: 100,
    })

    expect(first).toEqual(second)
    expect(first.candidates).toHaveLength(3)
    expect(first.candidates[0]?.groups.map((group) => group.studentIds.length)).toEqual([2, 2, 2])
  })

  it('preserves locked group members across reruns', () => {
    let project = replacePlanningGroups(
      baseProject(),
      [
        { id: 'g1', label: 'A', studentIds: ['s1', 's2'] },
        { id: 'g2', label: 'B', studentIds: ['s3', 's4'] },
        { id: 'g3', label: 'C', studentIds: ['s5', 's6'] },
      ],
      'manual-grouping',
      t0,
    )
    project = setGroupStudentLocked(project, 'g1', 's1', true, t0)

    const result = generateGroupingCandidates(project, {
      groupCount: 3,
      seed: 'rerun',
      candidateCount: 3,
      attempts: 100,
    })

    for (const candidate of result.candidates) {
      expect(candidate.groups.find((group) => group.id === 'g1')?.studentIds).toContain('s1')
      expect(candidate.groups.find((group) => group.id === 'g1')?.lockedStudentIds).toContain('s1')
    }
  })

  it('balances an explicit metric and ignores missing values', () => {
    let project = baseProject()
    project = addMetricDefinition(project, { key: 'score', label: 'Score', kind: 'number' }, t0)
    for (const [id, value] of [
      ['s1', 90],
      ['s2', 80],
      ['s3', 70],
      ['s4', 40],
      ['s5', 30],
    ] as const) {
      project = setStudentMetricValue(project, id, 'score', value, t0)
    }

    const result = generateGroupingCandidates(project, {
      groupCount: 2,
      seed: 'metric',
      metricKey: 'score',
      candidateCount: 3,
      attempts: 200,
    })

    const best = result.candidates[0]!
    const metric = best.objectiveResults.find((item) => item.kind === 'metric-balance')
    expect(metric?.details).toContain('1 student(s) lacked a recorded value and were ignored')
    expect(best.totalPenalty).toBe(
      best.objectiveResults.reduce((sum, item) => sum + item.penalty, 0),
    )
  })

  it('rejects unsupported balance metrics', () => {
    let project = baseProject()
    project = addMetricDefinition(project, { key: 'note', label: 'Note', kind: 'text' }, t0)

    expect(() =>
      generateGroupingCandidates(project, {
        groupCount: 2,
        metricKey: 'note',
      }),
    ).toThrow('CG-4022')
  })
})
