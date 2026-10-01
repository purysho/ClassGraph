import { describe, expect, it } from 'vitest'
import { generateSyntheticProject } from '../src/synthetic.js'

const spec = {
  seed: 'demo-001',
  projectId: 'project-demo',
  title: 'Demo class',
  studentCount: 12,
  generatedAt: '2026-10-01T00:00:00.000Z',
  metricDefinitions: [
    {
      key: 'assessment',
      label: 'Assessment',
      kind: 'number' as const,
      numberScale: { min: 0, max: 100 },
      missingAllowed: true,
    },
    {
      key: 'support',
      label: 'Support',
      kind: 'category' as const,
      categories: ['low', 'core', 'high'],
    },
  ],
  metrics: [
    {
      key: 'assessment',
      kind: 'number' as const,
      distribution: {
        type: 'normal' as const,
        mean: 70,
        standardDeviation: 12,
        min: 0,
        max: 100,
      },
      missingRate: 0.1,
    },
    {
      key: 'support',
      kind: 'category' as const,
      values: [
        { value: 'low', weight: 1 },
        { value: 'core', weight: 3 },
        { value: 'high', weight: 1 },
      ],
    },
  ],
}

describe('generateSyntheticProject', () => {
  it('is deterministic for the same seed and specification', () => {
    expect(generateSyntheticProject(spec)).toEqual(generateSyntheticProject(spec))
  })

  it('changes generated values when the seed changes', () => {
    const first = generateSyntheticProject(spec)
    const second = generateSyntheticProject({ ...spec, seed: 'demo-002' })
    expect(first.students.map((student) => student.metrics)).not.toEqual(
      second.students.map((student) => student.metrics),
    )
  })

  it('marks generated metric fields as synthetic', () => {
    const project = generateSyntheticProject(spec)
    expect(project.provenance['/students/0/metrics/assessment']?.kind).toBe('synthetic')
    expect(project.provenance['/students/0/metrics/support']?.kind).toBe('synthetic')
  })
})
