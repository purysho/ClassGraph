import { describe, expect, it } from 'vitest'
import { deterministicInt, deterministicUnit } from '../src/random.js'

describe('deterministic random source', () => {
  it('returns the same value for the same seed and key', () => {
    expect(deterministicUnit('seed', 'student:1')).toBe(deterministicUnit('seed', 'student:1'))
  })

  it('is keyed rather than draw-order dependent', () => {
    const targetBefore = deterministicUnit('seed', 'target')
    void deterministicUnit('seed', 'unrelated')
    const targetAfter = deterministicUnit('seed', 'target')
    expect(targetAfter).toBe(targetBefore)
  })

  it('returns integers inside the requested range', () => {
    const value = deterministicInt('seed', 'integer', 2, 4)
    expect(value).toBeGreaterThanOrEqual(2)
    expect(value).toBeLessThanOrEqual(4)
  })
})
