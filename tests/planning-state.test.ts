import { describe, expect, it } from 'vitest'
import {
  addPlanningRule,
  assignStudentToSeat,
  replacePlanningGroups,
  replaceSeatAssignments,
  setGroupStudentLocked,
  setPlanningSeed,
  setSeatAssignmentLocked,
  unassignStudentFromSeat,
} from '../src/planning-state.js'
import type { ClassGraphProject } from '../src/model.js'
import { setGridRoom, setSeatEnabled } from '../src/room.js'
import { addStudent, createEmptyProject } from '../src/workspace.js'

const t0 = '2026-10-01T10:00:00.000Z'
const t1 = '2026-10-01T10:01:00.000Z'

function projectWithRoom(): ClassGraphProject {
  let project = createEmptyProject({ projectId: 'p2', title: 'P2', now: t0 })
  project = addStudent(project, { id: 's1', displayName: 'One' }, t0)
  project = addStudent(project, { id: 's2', displayName: 'Two' }, t0)
  project = setGridRoom(project, 2, 2, t0)
  return project
}

describe('planning state', () => {
  it('stores manual assignments and locks with teacher provenance', () => {
    let project = assignStudentToSeat(projectWithRoom(), 's1', 'seat-r1-c1', false, t1)
    project = setSeatAssignmentLocked(project, 's1', true, t1)

    expect(project.planning?.assignments).toEqual([
      { studentId: 's1', seatId: 'seat-r1-c1', locked: true },
    ])
    expect(project.provenance['/planning/assignments/0']?.kind).toBe('teacher-entered')
  })

  it('rejects disabled or occupied seats', () => {
    let project = projectWithRoom()
    project = setSeatEnabled(project, 'seat-r1-c2', false, t1)
    expect(() => assignStudentToSeat(project, 's1', 'seat-r1-c2', false, t1)).toThrow('CG-4012')

    project = assignStudentToSeat(project, 's1', 'seat-r1-c1', false, t1)
    expect(() => assignStudentToSeat(project, 's2', 'seat-r1-c1', false, t1)).toThrow('CG-4013')
  })

  it('unassigns students without changing other assignments', () => {
    let project = projectWithRoom()
    project = assignStudentToSeat(project, 's1', 'seat-r1-c1', false, t1)
    project = assignStudentToSeat(project, 's2', 'seat-r1-c2', false, t1)
    project = unassignStudentFromSeat(project, 's1', t1)

    expect(project.planning?.assignments).toEqual([
      { studentId: 's2', seatId: 'seat-r1-c2', locked: false },
    ])
  })

  it('stores a deterministic planning seed and typed rules', () => {
    let project = setPlanningSeed(projectWithRoom(), 'seed-1', t1)
    project = addPlanningRule(
      project,
      {
        id: 'rule-1',
        strength: 'hard',
        kind: 'keep-apart',
        studentAId: 's1',
        studentBId: 's2',
      },
      t1,
    )

    expect(project.planning?.seed).toBe('seed-1')
    expect(project.planning?.rules?.[0]?.kind).toBe('keep-apart')
  })

  it('applies candidate assignments through the validated planning contract', () => {
    const project = replaceSeatAssignments(
      projectWithRoom(),
      [
        { studentId: 's1', seatId: 'seat-r1-c1', locked: false },
        { studentId: 's2', seatId: 'seat-r2-c2', locked: false },
      ],
      'accepted-seating-candidate',
      t1,
    )

    expect(project.planning?.assignments).toHaveLength(2)
    expect(project.provenance['/planning/assignments']?.source).toBe('accepted-seating-candidate')
  })

  it('stores groups and supports per-student group locks', () => {
    let project = replacePlanningGroups(
      projectWithRoom(),
      [
        { id: 'g1', label: 'Group 1', studentIds: ['s1'] },
        { id: 'g2', label: 'Group 2', studentIds: ['s2'] },
      ],
      'manual-grouping',
      t1,
    )
    project = setGroupStudentLocked(project, 'g1', 's1', true, t1)

    expect(project.planning?.groups?.[0]?.lockedStudentIds).toEqual(['s1'])
  })
})
