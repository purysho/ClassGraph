import { describe, expect, it } from 'vitest'
import { addMetricDefinition, setStudentMetricValue } from '../src/metrics.js'
import {
  addPlanningRule,
  assignStudentToSeat,
  setSeatAssignmentLocked,
} from '../src/planning-state.js'
import { generateSeatingCandidates } from '../src/planning.js'
import { setGridRoom, setSeatTags } from '../src/room.js'
import { addStudent, createEmptyProject } from '../src/workspace.js'

const t0 = '2026-10-01T10:00:00.000Z'

function baseProject() {
  let project = createEmptyProject({ projectId: 'seat', title: 'Seating', now: t0 })
  for (const id of ['s1', 's2', 's3', 's4']) {
    project = addStudent(project, { id }, t0)
  }
  project = setGridRoom(project, 2, 2, t0)
  return project
}

describe('seating candidate engine', () => {
  it('is deterministic for the same project and seed', () => {
    const first = generateSeatingCandidates(baseProject(), {
      seed: 'same',
      candidateCount: 3,
      attempts: 80,
    })
    const second = generateSeatingCandidates(baseProject(), {
      seed: 'same',
      candidateCount: 3,
      attempts: 80,
    })

    expect(first).toEqual(second)
    expect(first.candidates).toHaveLength(3)
  })

  it('preserves teacher-locked assignments across every candidate', () => {
    let project = assignStudentToSeat(baseProject(), 's1', 'seat-r2-c2', false, t0)
    project = setSeatAssignmentLocked(project, 's1', true, t0)

    const result = generateSeatingCandidates(project, { seed: 'lock', attempts: 100 })

    expect(result.candidates.length).toBeGreaterThan(0)
    for (const candidate of result.candidates) {
      expect(candidate.assignments.find((item) => item.studentId === 's1')).toEqual({
        studentId: 's1',
        seatId: 'seat-r2-c2',
        locked: true,
      })
    }
  })

  it('reports insufficient capacity before search', () => {
    let project = baseProject()
    project.room!.seats[0]!.enabled = false

    const result = generateSeatingCandidates(project, { seed: 'capacity' })

    expect(result.candidates).toEqual([])
    expect(result.infeasibleReasons[0]).toContain('Enabled capacity is 3 seats for 4 students')
    expect(result.attempts).toBe(0)
  })

  it('satisfies hard seat-tag and separation rules when a feasible arrangement exists', () => {
    let project = setSeatTags(baseProject(), 'seat-r1-c1', ['front'], t0)
    project = addPlanningRule(
      project,
      {
        id: 'front-s1',
        strength: 'hard',
        kind: 'seat-tag-required',
        studentId: 's1',
        tag: 'front',
      },
      t0,
    )
    project = addPlanningRule(
      project,
      {
        id: 'apart',
        strength: 'hard',
        kind: 'keep-apart',
        studentAId: 's1',
        studentBId: 's2',
        neighbourMode: 'orthogonal',
      },
      t0,
    )

    const result = generateSeatingCandidates(project, {
      seed: 'hard',
      candidateCount: 2,
      attempts: 500,
    })

    expect(result.candidates.length).toBeGreaterThan(0)
    for (const candidate of result.candidates) {
      expect(candidate.hardConstraintResults.every((item) => item.satisfied)).toBe(true)
      expect(candidate.assignments.find((item) => item.studentId === 's1')?.seatId).toBe(
        'seat-r1-c1',
      )
    }
  })

  it('exposes soft-objective components and ignores missing metric values', () => {
    let project = baseProject()
    project = addMetricDefinition(
      project,
      { key: 'score', label: 'Score', kind: 'number', numberScale: { min: 0, max: 100 } },
      t0,
    )
    project = setStudentMetricValue(project, 's1', 'score', 90, t0)
    project = setStudentMetricValue(project, 's2', 'score', 20, t0)
    project = setStudentMetricValue(project, 's3', 'score', null, t0)
    project = addPlanningRule(
      project,
      {
        id: 'balance',
        strength: 'soft',
        kind: 'balance-metric-by-row',
        metricKey: 'score',
        weight: 2,
      },
      t0,
    )
    project = addPlanningRule(
      project,
      {
        id: 'together',
        strength: 'soft',
        kind: 'prefer-together',
        studentAId: 's1',
        studentBId: 's2',
      },
      t0,
    )

    const result = generateSeatingCandidates(project, {
      seed: 'soft',
      candidateCount: 3,
      attempts: 200,
    })

    expect(result.candidates).toHaveLength(3)
    const best = result.candidates[0]!
    expect(best.objectiveResults).toHaveLength(2)
    expect(best.objectiveResults.find((item) => item.ruleId === 'balance')?.details).toContain(
      'lacked a recorded value and were ignored',
    )
    expect(best.totalPenalty).toBe(
      best.objectiveResults.reduce((sum, item) => sum + item.penalty, 0),
    )
  })

  it('explains a hard tag requirement that cannot be satisfied', () => {
    let project = addPlanningRule(
      baseProject(),
      {
        id: 'window',
        strength: 'hard',
        kind: 'seat-tag-required',
        studentId: 's1',
        tag: 'window',
      },
      t0,
    )

    const result = generateSeatingCandidates(project, { seed: 'no-window' })

    expect(result.candidates).toEqual([])
    expect(result.infeasibleReasons[0]).toContain('no enabled seat has that tag')
  })
})
