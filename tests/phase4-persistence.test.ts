import { describe, expect, it } from 'vitest'
import { parseProjectJson, serializeProjectJson } from '../src/json.js'
import { recordApprovedSeatingHistory } from '../src/planning-history.js'
import { savePlanningScenario } from '../src/planning-scenarios.js'
import { assignStudentToSeat, replacePlanningGroups } from '../src/planning-state.js'
import { addRelationship } from '../src/relationships.js'
import { setGridRoom } from '../src/room.js'
import { addStudent, createEmptyProject } from '../src/workspace.js'

const t0 = '2026-10-02T00:00:00.000Z'
const t1 = '2026-10-02T00:01:00.000Z'
const t2 = '2026-10-02T00:02:00.000Z'

describe('Phase 4 persistence', () => {
  it('round trips explicit relationships, history and saved scenarios without provenance loss', () => {
    let project = createEmptyProject({ projectId: 'phase4-roundtrip', title: 'Phase 4', now: t0 })
    project = addStudent(project, { id: 's1' }, t0)
    project = addStudent(project, { id: 's2' }, t0)
    project = setGridRoom(project, 1, 2, t0)
    project = assignStudentToSeat(project, 's1', 'seat-r1-c1', false, t0)
    project = assignStudentToSeat(project, 's2', 'seat-r1-c2', false, t0)
    project = replacePlanningGroups(
      project,
      [{ id: 'g1', studentIds: ['s1', 's2'] }],
      'manual-grouping',
      t0,
    )
    project = addRelationship(
      project,
      {
        id: 'r1',
        fromStudentId: 's1',
        toStudentId: 's2',
        type: 'support-pair',
      },
      t0,
    )
    project.provenance['/relationships/0'] = { kind: 'synthetic', source: 'fixture' }
    project = recordApprovedSeatingHistory(
      project,
      { label: 'Approved 1', neighbourMode: 'orthogonal' },
      t1,
    )
    project = savePlanningScenario(project, 'Baseline', t2)

    const roundTripped = parseProjectJson(serializeProjectJson(project))

    expect(roundTripped.relationships).toEqual(project.relationships)
    expect(roundTripped.planning?.history).toEqual(project.planning?.history)
    expect(roundTripped.planning?.scenarios).toEqual(project.planning?.scenarios)
    expect(roundTripped.provenance['/relationships/0']).toEqual({
      kind: 'synthetic',
      source: 'fixture',
    })
  })
})
