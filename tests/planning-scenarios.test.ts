import { describe, expect, it } from 'vitest'
import {
  buildPlanningScenario,
  comparePlanningScenarios,
  savePlanningScenario,
} from '../src/planning-scenarios.js'
import { addStudent, createEmptyProject } from '../src/workspace.js'
import { setGridRoom } from '../src/room.js'
import {
  assignStudentToSeat,
  replacePlanningGroups,
} from '../src/planning-state.js'
import { addRelationship } from '../src/relationships.js'

const t0 = '2026-10-02T00:00:00.000Z'
const t1 = '2026-10-02T00:01:00.000Z'
const t2 = '2026-10-02T00:02:00.000Z'

function project() {
  let value = createEmptyProject({ projectId: 'scenario', title: 'Scenario', now: t0 })
  for (const id of ['s1', 's2', 's3']) value = addStudent(value, { id }, t0)
  value = setGridRoom(value, 2, 2, t0)
  value = assignStudentToSeat(value, 's1', 'seat-r1-c1', false, t0)
  value = assignStudentToSeat(value, 's2', 'seat-r1-c2', false, t0)
  value = replacePlanningGroups(
    value,
    [
      { id: 'g1', studentIds: ['s1', 's2'] },
      { id: 'g2', studentIds: ['s3'] },
    ],
    'manual-grouping',
    t0,
  )
  value = addRelationship(
    value,
    {
      id: 'r1',
      fromStudentId: 's1',
      toStudentId: 's2',
      type: 'works-well-with',
    },
    t0,
  )
  return value
}

describe('planning scenarios', () => {
  it('creates deterministic IDs from the label and exact persisted planning state', () => {
    const first = buildPlanningScenario(project(), 'Baseline', t1)
    const second = buildPlanningScenario(project(), 'Baseline', t2)

    expect(first.id).toBe(second.id)
    expect(first.savedAt).not.toBe(second.savedAt)
    expect(first.version).toBe('1.0')
  })

  it('does not include transient candidate state that is outside the project model', () => {
    const snapshot = buildPlanningScenario(project(), 'Baseline', t1)

    expect(snapshot.assignments).toHaveLength(2)
    expect(snapshot.groups).toHaveLength(2)
    expect(snapshot).not.toHaveProperty('candidates')
  })

  it('saves scenario provenance separately from current planning provenance', () => {
    const saved = savePlanningScenario(project(), 'Baseline', t1)

    expect(saved.planning?.scenarios).toHaveLength(1)
    expect(saved.provenance['/planning/scenarios/0']).toEqual({
      kind: 'teacher-entered',
      source: 'saved-planning-scenario',
    })
  })

  it('compares exact saved planning states descriptively', () => {
    let value = savePlanningScenario(project(), 'Before', t1)
    value = assignStudentToSeat(value, 's1', 'seat-r2-c1', false, t1)
    value = replacePlanningGroups(
      value,
      [
        { id: 'g1', studentIds: ['s1', 's3'] },
        { id: 'g2', studentIds: ['s2'] },
      ],
      'manual-grouping',
      t1,
    )
    value = savePlanningScenario(value, 'After', t2)

    const [before, after] = value.planning?.scenarios ?? []
    if (!before || !after) throw new Error('scenario fixtures missing')
    const comparison = comparePlanningScenarios(value, before.id, after.id)

    expect(comparison.assignments.movedStudents).toEqual(['s1'])
    expect(comparison.groups.changedStudents).toEqual(['s2', 's3'])
    expect(comparison.network.counts.find((item) => item.key === 'within-group')).toMatchObject({
      left: 1,
      right: 0,
      delta: -1,
    })
    expect(comparison).not.toHaveProperty('winner')
    expect(comparison).not.toHaveProperty('score')
  })
})
