import { describe, expect, it } from 'vitest'
import { summarizeCategoryMetric, summarizeNumericMetric } from '../src/analysis.js'
import type { ClassGraphProject } from '../src/model.js'

const project: ClassGraphProject = {
  schemaVersion: '1.0',
  projectId: 'analysis',
  title: 'Analysis fixture',
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
  classInfo: {},
  metricDefinitions: [
    { key: 'score', label: 'Score', kind: 'number', missingAllowed: true },
    {
      key: 'group',
      label: 'Group',
      kind: 'category',
      categories: ['A', 'B'],
      missingAllowed: true,
    },
  ],
  students: [
    { id: 's1', metrics: { score: 10, group: 'A' } },
    { id: 's2', metrics: { score: 20, group: 'A' } },
    { id: 's3', metrics: { score: 30, group: 'B' } },
    { id: 's4', metrics: { score: null, group: null } },
  ],
  provenance: {},
}

describe('analysis', () => {
  it('summarizes numeric data while preserving missingness', () => {
    const summary = summarizeNumericMetric(project, 'score')
    expect(summary.recordedCount).toBe(3)
    expect(summary.missingCount).toBe(1)
    expect(summary.mean).toBe(20)
    expect(summary.median).toBe(20)
    expect(summary.min).toBe(10)
    expect(summary.max).toBe(30)
  })

  it('counts category values and missing values separately', () => {
    const summary = summarizeCategoryMetric(project, 'group')
    expect(summary.counts).toEqual({ A: 2, B: 1 })
    expect(summary.missingCount).toBe(1)
  })
})
