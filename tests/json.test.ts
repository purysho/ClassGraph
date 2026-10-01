import { describe, expect, it } from 'vitest'
import { ClassGraphImportError, parseProjectJson, serializeProjectJson } from '../src/json.js'
import type { ClassGraphProject } from '../src/model.js'

const project: ClassGraphProject = {
  schemaVersion: '1.0',
  projectId: 'roundtrip',
  title: 'Round trip',
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
  classInfo: { subject: 'English' },
  metricDefinitions: [{ key: 'score', label: 'Score', kind: 'number' }],
  students: [{ id: 'student-001', metrics: { score: 77 } }],
  provenance: {
    '/students/0/metrics/score': { kind: 'imported', source: 'fixture' },
  },
  extensions: { futureField: { preserved: true } },
}

describe('JSON interchange', () => {
  it('round trips a valid project', () => {
    const serialized = serializeProjectJson(project)
    expect(parseProjectJson(serialized)).toEqual(project)
  })

  it('returns a coded import error for malformed JSON', () => {
    expect(() => parseProjectJson('{')).toThrow(ClassGraphImportError)

    try {
      parseProjectJson('{')
    } catch (error) {
      expect((error as ClassGraphImportError).code).toBe('CG-1001')
    }
  })
})
