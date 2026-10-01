import type {
  ClassGraphProject,
  ProvenanceEntry,
  RoomDefinition,
  RoomFront,
  SeatDefinition,
} from './model.js'
import { classGraphProjectSchema } from './schema.js'

export const MAX_GRID_SEATS = 1000

function teacherEntered(source: string): ProvenanceEntry {
  return { kind: 'teacher-entered', source }
}

function cloneProject(project: ClassGraphProject): ClassGraphProject {
  return structuredClone(project)
}

function validate(project: ClassGraphProject): ClassGraphProject {
  return classGraphProjectSchema.parse(project)
}

function assertGridDimensions(rows: number, columns: number): void {
  if (!Number.isInteger(rows) || rows < 1) {
    throw new Error('CG-4001 room rows must be a positive integer')
  }
  if (!Number.isInteger(columns) || columns < 1) {
    throw new Error('CG-4001 room columns must be a positive integer')
  }
  if (rows * columns > MAX_GRID_SEATS) {
    throw new Error(`CG-4002 grid room cannot exceed ${MAX_GRID_SEATS} seats`)
  }
}

export function gridSeatId(row: number, column: number): string {
  return `seat-r${row + 1}-c${column + 1}`
}

function coordinateKey(row: number, column: number): string {
  return `${row}:${column}`
}

function previousGridSeats(room: RoomDefinition | undefined): Map<string, SeatDefinition> {
  const result = new Map<string, SeatDefinition>()
  if (room?.layout !== 'grid') return result

  for (const seat of room.seats) {
    if (seat.row === undefined || seat.column === undefined) continue
    result.set(coordinateKey(seat.row, seat.column), seat)
  }

  return result
}

export function createGridRoom(
  rows: number,
  columns: number,
  previousRoom?: RoomDefinition,
  front?: RoomFront,
): RoomDefinition {
  assertGridDimensions(rows, columns)
  const previous = previousGridSeats(previousRoom)
  const seats: SeatDefinition[] = []

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const oldSeat = previous.get(coordinateKey(row, column))
      seats.push({
        id: oldSeat?.id ?? gridSeatId(row, column),
        row,
        column,
        enabled: oldSeat?.enabled ?? true,
        ...(oldSeat?.tags ? { tags: [...oldSeat.tags] } : {}),
      })
    }
  }

  return {
    layout: 'grid',
    rows,
    columns,
    front: front ?? previousRoom?.front ?? 'top',
    seats,
  }
}

function roomSeatIndex(project: ClassGraphProject, seatId: string): number {
  const index = project.room?.seats.findIndex((seat) => seat.id === seatId) ?? -1
  if (index < 0) throw new Error(`CG-4003 unknown seat: ${seatId}`)
  return index
}

function remapRoomSeatProvenance(
  project: ClassGraphProject,
  nextSeats: SeatDefinition[],
): ClassGraphProject['provenance'] {
  const next: ClassGraphProject['provenance'] = {}
  const oldSeatIds = project.room?.seats.map((seat) => seat.id) ?? []
  const nextIndexById = new Map(nextSeats.map((seat, index) => [seat.id, index]))

  for (const [path, entry] of Object.entries(project.provenance)) {
    const match = /^\/room\/seats\/(\d+)(\/.*)?$/.exec(path)
    if (!match) {
      next[path] = entry
      continue
    }

    const oldIndex = Number(match[1])
    const seatId = oldSeatIds[oldIndex]
    if (!seatId) continue
    const newIndex = nextIndexById.get(seatId)
    if (newIndex === undefined) continue
    next[`/room/seats/${newIndex}${match[2] ?? ''}`] = entry
  }

  return next
}

export function setGridRoom(
  project: ClassGraphProject,
  rows: number,
  columns: number,
  now: string,
  front?: RoomFront,
): ClassGraphProject {
  const next = cloneProject(project)
  const room = createGridRoom(rows, columns, project.room, front)
  next.provenance = remapRoomSeatProvenance(project, room.seats)
  next.room = room
  next.provenance['/room'] = teacherEntered('manual-room-grid')
  next.updatedAt = now
  return validate(next)
}

export function setSeatEnabled(
  project: ClassGraphProject,
  seatId: string,
  enabled: boolean,
  now: string,
): ClassGraphProject {
  const index = roomSeatIndex(project, seatId)
  const next = cloneProject(project)
  const seat = next.room?.seats[index]
  if (!seat) throw new Error(`CG-9001 seat index unexpectedly missing: ${seatId}`)

  seat.enabled = enabled
  next.provenance[`/room/seats/${index}/enabled`] = teacherEntered('manual-seat-edit')
  next.updatedAt = now
  return validate(next)
}

export function setSeatTags(
  project: ClassGraphProject,
  seatId: string,
  tags: string[],
  now: string,
): ClassGraphProject {
  const index = roomSeatIndex(project, seatId)
  const normalized = [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))]
  const next = cloneProject(project)
  const seat = next.room?.seats[index]
  if (!seat) throw new Error(`CG-9001 seat index unexpectedly missing: ${seatId}`)

  if (normalized.length === 0) {
    delete seat.tags
    delete next.provenance[`/room/seats/${index}/tags`]
  } else {
    seat.tags = normalized
    next.provenance[`/room/seats/${index}/tags`] = teacherEntered('manual-seat-edit')
  }

  next.updatedAt = now
  return validate(next)
}

export function setRoomFront(
  project: ClassGraphProject,
  front: RoomFront,
  now: string,
): ClassGraphProject {
  if (!project.room) throw new Error('CG-4004 create a room before setting its front orientation')
  const next = cloneProject(project)
  if (!next.room) throw new Error('CG-9001 room unexpectedly missing')
  next.room.front = front
  next.provenance['/room/front'] = teacherEntered('manual-room-orientation')
  next.updatedAt = now
  return validate(next)
}

export function roomCapacity(room: RoomDefinition | undefined): number {
  return room?.seats.filter((seat) => seat.enabled).length ?? 0
}
