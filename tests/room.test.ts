import { describe, expect, it } from 'vitest'
import {
  createGridRoom,
  gridSeatId,
  roomCapacity,
  setGridRoom,
  setRoomFront,
  setSeatEnabled,
  setSeatTags,
} from '../src/room.js'
import { createEmptyProject } from '../src/workspace.js'

const t0 = '2026-10-01T10:00:00.000Z'
const t1 = '2026-10-01T10:01:00.000Z'
const t2 = '2026-10-01T10:02:00.000Z'

function emptyProject() {
  return createEmptyProject({
    projectId: 'room-test',
    title: 'Room Test',
    now: t0,
  })
}

describe('room grid service', () => {
  it('creates deterministic zero-based grid coordinates and stable IDs', () => {
    const first = createGridRoom(2, 3)
    const second = createGridRoom(2, 3)

    expect(first).toEqual(second)
    expect(first.seats.map((seat) => seat.id)).toEqual([
      'seat-r1-c1',
      'seat-r1-c2',
      'seat-r1-c3',
      'seat-r2-c1',
      'seat-r2-c2',
      'seat-r2-c3',
    ])
    expect(first.seats[5]).toMatchObject({ row: 1, column: 2, enabled: true })
    expect(gridSeatId(1, 2)).toBe('seat-r2-c3')
  })

  it('preserves compatible seat state when a grid is resized', () => {
    let project = setGridRoom(emptyProject(), 2, 2, t1)
    project = setSeatEnabled(project, 'seat-r1-c2', false, t1)
    project = setSeatTags(project, 'seat-r2-c1', ['front', ' aisle ', 'front'], t1)

    const resized = setGridRoom(project, 3, 3, t2)

    expect(resized.room?.seats.find((seat) => seat.id === 'seat-r1-c2')?.enabled).toBe(false)
    expect(resized.room?.seats.find((seat) => seat.id === 'seat-r2-c1')?.tags).toEqual([
      'front',
      'aisle',
    ])
    expect(resized.room?.seats.find((seat) => seat.id === 'seat-r3-c3')?.enabled).toBe(true)
  })

  it('keeps disabled seats in geometry while reducing usable capacity', () => {
    let project = setGridRoom(emptyProject(), 2, 2, t1)
    project = setSeatEnabled(project, 'seat-r1-c1', false, t2)

    expect(project.room?.seats).toHaveLength(4)
    expect(roomCapacity(project.room)).toBe(3)
    expect(project.provenance['/room/seats/0/enabled']?.kind).toBe('teacher-entered')
  })

  it('remaps seat provenance by stable seat ID during resize', () => {
    let project = setGridRoom(emptyProject(), 2, 3, t1)
    project = setSeatTags(project, 'seat-r2-c1', ['front'], t1)

    const resized = setGridRoom(project, 3, 2, t2)
    const newIndex = resized.room?.seats.findIndex((seat) => seat.id === 'seat-r2-c1')

    expect(newIndex).toBe(2)
    expect(resized.provenance['/room/seats/2/tags']?.kind).toBe('teacher-entered')
    expect(resized.provenance['/room/seats/3/tags']).toBeUndefined()
  })

  it('rejects impossible grid dimensions and unknown seats', () => {
    expect(() => createGridRoom(0, 2)).toThrow('CG-4001')
    expect(() => createGridRoom(100, 100)).toThrow('CG-4002')
    expect(() => setSeatEnabled(emptyProject(), 'missing-seat', false, t1)).toThrow('CG-4003')
  })

  it('stores and updates explicit front-of-room orientation', () => {
    let project = setGridRoom(emptyProject(), 2, 2, t1, 'left')
    expect(project.room?.front).toBe('left')

    project = setRoomFront(project, 'bottom', t2)
    expect(project.room?.front).toBe('bottom')
    expect(project.provenance['/room/front']?.kind).toBe('teacher-entered')
  })

})
