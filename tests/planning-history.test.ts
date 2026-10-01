import { describe, expect, it } from 'vitest'
import {
  buildRepeatNeighbourHistory,
  recordApprovedSeatingHistory,
} from '../src/planning-history.js'
import { addStudent, createEmptyProject } from '../src/workspace.js'
import { setGridRoom } from '../src/room.js'
import { assignStudentToSeat } from '../src/planning-state.js'

const t0 = '2026-10-02T00:00:00.000Z'
const t1 = '2026-10-02T00:01:00.000Z'
const t2 = '2026-10-02T00:02:00.000Z'

function seatedProject() {
  let project = createEmptyProject({ projectId: 'history', title: 'History', now: t0 })
  for (const id of ['s1', 's2', 's3']) project = addStudent(project, { id }, t0)
  project = setGridRoom(project, 2, 2, t0)
  project = assignStudentToSeat(project, 's1', 'seat-r1-c1', false, t0)
  project = assignStudentToSeat(project, 's2', 'seat-r1-c2', false, t0)
  project = assignStudentToSeat(project, 's3', 'seat-r2-c2', false, t0)
  return project
}

describe('approved seating history', () => {
  it('records only persisted approved/current seating when explicitly requested', () => {
    const project = recordApprovedSeatingHistory(
      seatedProject(),
      { label: 'Week 1', neighbourMode: 'orthogonal' },
      t1,
    )

    expect(project.planning?.history).toHaveLength(1)
    expect(project.planning?.history?.[0]).toMatchObject({
      version: '1.0',
      label: 'Week 1',
      approvedAt: t1,
      neighbourMode: 'orthogonal',
    })
    expect(project.provenance['/planning/history/0']).toEqual({
      kind: 'teacher-entered',
      source: 'approved-seating-history',
    })
  })

  it('does not invent history from the current seating plan', () => {
    const summary = buildRepeatNeighbourHistory(seatedProject())

    expect(summary.historyRecordCount).toBe(0)
    expect(summary.pairs).toEqual([])
  })

  it('counts repeat neighbours only across stored history snapshots', () => {
    let project = recordApprovedSeatingHistory(seatedProject(), { neighbourMode: 'orthogonal' }, t1)
    project = recordApprovedSeatingHistory(project, { neighbourMode: 'orthogonal' }, t2)

    const summary = buildRepeatNeighbourHistory(project)

    expect(summary.historyRecordCount).toBe(2)
    expect(summary.usableRecordCount).toBe(2)
    expect(
      summary.pairs.find((pair) => pair.studentAId === 's1' && pair.studentBId === 's2'),
    ).toMatchObject({
      count: 2,
    })
    expect(
      summary.pairs.find((pair) => pair.studentAId === 's2' && pair.studentBId === 's3'),
    ).toMatchObject({
      count: 2,
    })
  })

  it('respects the recorded neighbour mode for each snapshot', () => {
    const orthogonal = recordApprovedSeatingHistory(
      seatedProject(),
      { neighbourMode: 'orthogonal' },
      t1,
    )
    const king = recordApprovedSeatingHistory(seatedProject(), { neighbourMode: 'king' }, t1)

    expect(
      buildRepeatNeighbourHistory(orthogonal).pairs.some(
        (pair) => pair.studentAId === 's1' && pair.studentBId === 's3',
      ),
    ).toBe(false)
    expect(
      buildRepeatNeighbourHistory(king).pairs.some(
        (pair) => pair.studentAId === 's1' && pair.studentBId === 's3',
      ),
    ).toBe(true)
  })
})
