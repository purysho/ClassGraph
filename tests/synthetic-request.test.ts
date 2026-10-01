import { describe, expect, it } from 'vitest'
import { parseStructuredSyntheticRequest } from '../src/synthetic-request.js'

const valid = {
  projectId: 'synthetic-test',
  title: 'Synthetic Test',
  studentCount: 36,
  seed: 'seed-1',
  metricDefinitions: [
    {
      key: 'score',
      label: 'Score',
      kind: 'number',
      numberScale: { min: 0, max: 100 },
    },
    {
      key: 'group',
      label: 'Group',
      kind: 'category',
      categories: ['A', 'B'],
    },
  ],
  metrics: [
    {
      key: 'score',
      kind: 'number',
      distribution: {
        type: 'normal',
        mean: 70,
        standardDeviation: 10,
        min: 0,
        max: 100,
      },
      missingRate: 0.05,
    },
    {
      key: 'group',
      kind: 'category',
      values: [
        { value: 'A', weight: 2 },
        { value: 'B', weight: 1 },
      ],
      missingRate: 0,
    },
  ],
}

describe('structured synthetic request', () => {
  it('accepts a matched deterministic generation specification', () => {
    const parsed = parseStructuredSyntheticRequest(valid)
    expect(parsed.studentCount).toBe(36)
    expect(parsed.metrics).toHaveLength(2)
  })

  it('rejects a metric whose kind does not match its definition', () => {
    const invalid = structuredClone(valid)
    invalid.metrics[0] = {
      key: 'score',
      kind: 'category',
      values: [{ value: 'A', weight: 1 }],
      missingRate: 0,
    } as never

    expect(() => parseStructuredSyntheticRequest(invalid)).toThrow(
      'synthetic metric kind does not match definition',
    )
  })

  it('rejects missing rates outside 0–1', () => {
    const invalid = structuredClone(valid)
    invalid.metrics[0]!.missingRate = 1.2

    expect(() => parseStructuredSyntheticRequest(invalid)).toThrow('invalid synthetic specification')
  })
})
