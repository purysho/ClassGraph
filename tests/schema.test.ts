import { describe, expect, it } from 'vitest'
import type { ClassGraphProject } from '../src/model.js'
import { classGraphProjectSchema } from '../src/schema.js'

function validProject(): ClassGraphProject {
  return {
    schemaVersion: '1.0',
    projectId: 'p1',
    title: 'Test',
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    classInfo: {},
    metricDefinitions: [
      {
        key: 'score',
        label: 'Score',
        kind: 'number',
        numberScale: { min: 0, max: 100 },
      },
      { key: 'band', label: 'Band', kind: 'category', categories: ['A', 'B'] },
    ],
    students: [{ id: 's1', metrics: { score: 80, band: 'A' } }],
    provenance: {},
  }
}

describe('classGraphProjectSchema', () => {
  it('accepts a valid project', () => {
    expect(classGraphProjectSchema.parse(validProject()).projectId).toBe('p1')
  })

  it('rejects a metric without a definition', () => {
    const project = validProject()
    project.students[0]!.metrics.unknown = 1
    expect(classGraphProjectSchema.safeParse(project).success).toBe(false)
  })

  it('does not coerce missing values to zero', () => {
    const project = validProject()
    project.students[0]!.metrics.score = null
    const parsed = classGraphProjectSchema.parse(project)
    expect(parsed.students[0]?.metrics.score).toBeNull()
  })

  it('rejects duplicate student IDs', () => {
    const project = validProject()
    project.students.push({ id: 's1', metrics: { score: 70, band: 'B' } })
    expect(classGraphProjectSchema.safeParse(project).success).toBe(false)
  })

  it('rejects duplicate grid seat IDs and positions', () => {
    const project = validProject()
    project.room = {
      layout: 'grid',
      rows: 2,
      columns: 2,
      seats: [
        { id: 'seat-a', row: 0, column: 0, enabled: true },
        { id: 'seat-a', row: 0, column: 0, enabled: true },
      ],
    }

    const result = classGraphProjectSchema.safeParse(project)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.message.includes('duplicate seat id'))).toBe(
        true,
      )
      expect(
        result.error.issues.some((issue) => issue.message.includes('duplicate grid seat position')),
      ).toBe(true)
    }
  })

  it('rejects grid seats outside the configured room bounds', () => {
    const project = validProject()
    project.room = {
      layout: 'grid',
      rows: 2,
      columns: 2,
      seats: [{ id: 'seat-a', row: 2, column: 0, enabled: true }],
    }

    const result = classGraphProjectSchema.safeParse(project)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain('outside configured room rows')
    }
  })

  it('requires coordinates for custom room seats', () => {
    const project = validProject()
    project.room = {
      layout: 'custom',
      seats: [{ id: 'seat-a', enabled: true }],
    }

    const result = classGraphProjectSchema.safeParse(project)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain('custom room seats require x and y')
    }
  })
})
