import type { ApprovedSeatingHistoryEntry, ClassGraphProject, ProvenanceEntry } from './model.js'
import { classGraphProjectSchema } from './schema.js'
import { deterministicId } from './stable-id.js'

export interface RepeatNeighbourPair {
  studentAId: string
  studentBId: string
  count: number
  historyIds: string[]
}

export interface RepeatNeighbourHistory {
  historyRecordCount: number
  usableRecordCount: number
  skippedRecordIds: string[]
  pairs: RepeatNeighbourPair[]
}

function teacherEntered(source: string): ProvenanceEntry {
  return { kind: 'teacher-entered', source }
}

function cloneProject(project: ClassGraphProject): ClassGraphProject {
  return structuredClone(project)
}

function validate(project: ClassGraphProject): ClassGraphProject {
  return classGraphProjectSchema.parse(project)
}

function ensurePlanning(project: ClassGraphProject): NonNullable<ClassGraphProject['planning']> {
  project.planning ??= { ruleSchemaVersion: '1.0' }
  project.planning.ruleSchemaVersion ??= '1.0'
  return project.planning
}

function remapHistoryProvenance(
  provenance: ClassGraphProject['provenance'],
  removedIndex: number,
): ClassGraphProject['provenance'] {
  const result: ClassGraphProject['provenance'] = {}

  for (const [path, entry] of Object.entries(provenance)) {
    const match = /^\/planning\/history\/(\d+)(\/.*)?$/.exec(path)
    if (!match) {
      result[path] = entry
      continue
    }

    const index = Number(match[1])
    if (index === removedIndex) continue
    const suffix = match[2] ?? ''
    const nextIndex = index > removedIndex ? index - 1 : index
    result[`/planning/history/${nextIndex}${suffix}`] = entry
  }

  return result
}

export function recordApprovedSeatingHistory(
  project: ClassGraphProject,
  options: {
    label?: string
    neighbourMode: 'orthogonal' | 'king'
  },
  now: string,
): ClassGraphProject {
  if (!project.room) throw new Error('CG-4020 seating history requires a saved room')
  const assignments = project.planning?.assignments ?? []
  if (assignments.length === 0) {
    throw new Error('CG-4021 seating history requires persisted seat assignments')
  }

  const label = options.label?.trim()
  const snapshot = {
    version: '1.0' as const,
    ...(label ? { label } : {}),
    approvedAt: now,
    neighbourMode: options.neighbourMode,
    room: structuredClone(project.room),
    assignments: structuredClone(assignments),
  }
  const entry: ApprovedSeatingHistoryEntry = {
    id: deterministicId('history', snapshot),
    ...snapshot,
  }

  const next = cloneProject(project)
  const planning = ensurePlanning(next)
  planning.history ??= []
  if (planning.history.some((item) => item.id === entry.id)) {
    throw new Error(`CG-4022 duplicate seating history snapshot: ${entry.id}`)
  }
  planning.history.push(entry)
  next.provenance[`/planning/history/${planning.history.length - 1}`] = teacherEntered(
    'approved-seating-history',
  )
  next.updatedAt = now
  return validate(next)
}

export function removeApprovedSeatingHistory(
  project: ClassGraphProject,
  historyId: string,
  now: string,
): ClassGraphProject {
  const index = (project.planning?.history ?? []).findIndex((entry) => entry.id === historyId)
  if (index < 0) throw new Error(`CG-4023 unknown seating history record: ${historyId}`)

  const next = cloneProject(project)
  const planning = ensurePlanning(next)
  planning.history?.splice(index, 1)
  next.provenance = remapHistoryProvenance(next.provenance, index)
  next.updatedAt = now
  return validate(next)
}

function areNeighbours(
  left: { row: number; column: number },
  right: { row: number; column: number },
  mode: 'orthogonal' | 'king',
): boolean {
  const rowDistance = Math.abs(left.row - right.row)
  const columnDistance = Math.abs(left.column - right.column)

  if (mode === 'orthogonal') return rowDistance + columnDistance === 1
  return Math.max(rowDistance, columnDistance) === 1
}

export function buildRepeatNeighbourHistory(project: ClassGraphProject): RepeatNeighbourHistory {
  const history = project.planning?.history ?? []
  const skippedRecordIds: string[] = []
  const pairs = new Map<string, RepeatNeighbourPair>()
  let usableRecordCount = 0

  for (const entry of history) {
    if (entry.room.layout !== 'grid') {
      skippedRecordIds.push(entry.id)
      continue
    }

    const seats = new Map(
      entry.room.seats
        .filter(
          (seat): seat is typeof seat & { row: number; column: number } =>
            seat.enabled && seat.row !== undefined && seat.column !== undefined,
        )
        .map((seat) => [seat.id, { row: seat.row, column: seat.column }]),
    )

    usableRecordCount += 1
    for (let leftIndex = 0; leftIndex < entry.assignments.length; leftIndex += 1) {
      const leftAssignment = entry.assignments[leftIndex]
      if (!leftAssignment) continue
      const leftSeat = seats.get(leftAssignment.seatId)
      if (!leftSeat) continue

      for (let rightIndex = leftIndex + 1; rightIndex < entry.assignments.length; rightIndex += 1) {
        const rightAssignment = entry.assignments[rightIndex]
        if (!rightAssignment) continue
        const rightSeat = seats.get(rightAssignment.seatId)
        if (!rightSeat || !areNeighbours(leftSeat, rightSeat, entry.neighbourMode)) continue

        const [studentAId, studentBId] = [leftAssignment.studentId, rightAssignment.studentId].sort(
          (left, right) => left.localeCompare(right),
        )
        if (!studentAId || !studentBId) continue
        const key = `${studentAId}\u0000${studentBId}`
        const current = pairs.get(key)
        if (current) {
          current.count += 1
          current.historyIds.push(entry.id)
        } else {
          pairs.set(key, {
            studentAId,
            studentBId,
            count: 1,
            historyIds: [entry.id],
          })
        }
      }
    }
  }

  return {
    historyRecordCount: history.length,
    usableRecordCount,
    skippedRecordIds,
    pairs: [...pairs.values()].sort(
      (left, right) =>
        right.count - left.count ||
        left.studentAId.localeCompare(right.studentAId) ||
        left.studentBId.localeCompare(right.studentBId),
    ),
  }
}
