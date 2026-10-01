import { describe, expect, it } from 'vitest'
import { applyProjectMutation, parseProjectMutationRequest } from '../src/project-mutations.js'
import { createEmptyProject } from '../src/workspace.js'

const t0 = '2026-10-01T10:00:00.000Z'
const t1 = '2026-10-01T10:01:00.000Z'

function emptyProject() {
  return createEmptyProject({
    projectId: 'grade-5a',
    title: 'Grade 5A',
    now: t0,
  })
}

describe('project mutations', () => {
  it('adds a student through the typed command layer', () => {
    const project = applyProjectMutation(
      emptyProject(),
      {
        type: 'add-student',
        student: { id: 's-001', displayName: 'Student One' },
      },
      t1,
    )

    expect(project.students[0]?.id).toBe('s-001')
    expect(project.provenance['/students/0/displayName']?.kind).toBe('teacher-entered')
  })

  it('adds a metric and preserves explicit missing null values', () => {
    let project = applyProjectMutation(
      emptyProject(),
      {
        type: 'add-student',
        student: { id: 's-001' },
      },
      t1,
    )
    project = applyProjectMutation(
      project,
      {
        type: 'add-metric-definition',
        definition: { key: 'assessment', label: 'Assessment', kind: 'number' },
      },
      t1,
    )
    project = applyProjectMutation(
      project,
      {
        type: 'set-metric-value',
        studentId: 's-001',
        metricKey: 'assessment',
        value: null,
      },
      t1,
    )

    expect(project.students[0]?.metrics.assessment).toBeNull()
    expect(project.provenance['/students/0/metrics/assessment']?.kind).toBe('teacher-entered')
  })

  it('rejects malformed mutation commands before they reach the core', () => {
    const project = emptyProject()

    expect(() =>
      parseProjectMutationRequest({
        project,
        command: { type: 'remove-student', studentId: '' },
      }),
    ).toThrow('CG-1001 invalid mutation command')
  })

  it('removes a metric and its student values through the command layer', () => {
    let project = applyProjectMutation(
      emptyProject(),
      {
        type: 'add-student',
        student: { id: 's-001' },
      },
      t1,
    )
    project = applyProjectMutation(
      project,
      {
        type: 'add-metric-definition',
        definition: { key: 'flag', label: 'Flag', kind: 'boolean' },
      },
      t1,
    )
    project = applyProjectMutation(
      project,
      {
        type: 'set-metric-value',
        studentId: 's-001',
        metricKey: 'flag',
        value: false,
      },
      t1,
    )
    project = applyProjectMutation(
      project,
      { type: 'remove-metric-definition', metricKey: 'flag' },
      t1,
    )

    expect(project.metricDefinitions).toEqual([])
    expect(project.students[0]?.metrics).toEqual({})
  })

  it('creates and edits a grid room through the typed mutation layer', () => {
    let project = applyProjectMutation(
      emptyProject(),
      { type: 'set-grid-room', rows: 2, columns: 3 },
      t1,
    )
    project = applyProjectMutation(
      project,
      { type: 'set-seat-enabled', seatId: 'seat-r1-c2', enabled: false },
      t1,
    )
    project = applyProjectMutation(
      project,
      { type: 'set-seat-tags', seatId: 'seat-r1-c1', tags: ['front', 'aisle'] },
      t1,
    )

    expect(project.room?.rows).toBe(2)
    expect(project.room?.columns).toBe(3)
    expect(project.room?.seats).toHaveLength(6)
    expect(project.room?.seats.find((seat) => seat.id === 'seat-r1-c2')?.enabled).toBe(false)
    expect(project.room?.seats.find((seat) => seat.id === 'seat-r1-c1')?.tags).toEqual([
      'front',
      'aisle',
    ])
  })

  it('rejects malformed room mutation commands before they reach the room core', () => {
    expect(() =>
      parseProjectMutationRequest({
        project: emptyProject(),
        command: { type: 'set-grid-room', rows: 0, columns: 4 },
      }),
    ).toThrow('CG-1001 invalid mutation command')
  })

})
