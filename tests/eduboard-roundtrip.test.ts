import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { serializeEduBoardHandback } from '../src/eduboard-handback.js'
import { parseProjectJson } from '../src/json.js'
import { applyProjectMutation } from '../src/project-mutations.js'

// The same two fixtures live in EduBoard (src/shared/__tests__/fixtures/), so a change on either
// side that breaks the round trip fails a test in both repositories.
const exported = readFileSync('tests/fixtures/eduboard-class-export-v1.json', 'utf8')
const expectedHandback = readFileSync('tests/fixtures/eduboard-roundtrip-handback-v1.json', 'utf8')

describe('EduBoard round trip', () => {
  it('opens a class exported by EduBoard with its students, grid and seats', () => {
    const project = parseProjectJson(exported)
    expect(project.students.map((student) => [student.id, student.displayName])).toEqual([
      ['eb-student-1', '张喆'],
      ['eb-student-2', '李玥'],
      ['eb-student-3', 'Lily Chen'],
    ])
    expect(project.room).toMatchObject({ layout: 'grid', rows: 2, columns: 3 })
    expect(project.planning?.assignments).toHaveLength(2)
    expect(project.provenance['/students/0/displayName']).toEqual({
      kind: 'imported',
      source: 'eduboard',
    })
  })

  it('hands the approved seating back with the same EduBoard student IDs', () => {
    const now = '2026-10-07T09:00:00.000Z'
    let project = parseProjectJson(exported)
    project = applyProjectMutation(
      project,
      {
        type: 'set-seat-assignment',
        studentId: 'eb-student-3',
        seatId: 'seat-r2-c3',
        locked: true,
      },
      now,
    )
    project = applyProjectMutation(
      project,
      { type: 'set-seat-assignment', studentId: 'eb-student-1', seatId: 'seat-r2-c1' },
      now,
    )
    expect(serializeEduBoardHandback(project)).toBe(expectedHandback)
  })
})
