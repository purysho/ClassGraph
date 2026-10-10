import { mapPool } from './concurrency.js'
import type { Agent } from './harness.js'

export interface EvalCase {
  id: string
  task: string
  /** Return a score in [0,1]. */
  grade: (output: string) => number | Promise<number>
}

export interface EvalReport {
  meanScore: number
  passRate: number
  results: Array<{
    id: string
    score: number
    turns: number
    inputTokens: number
    outputTokens: number
    error?: string
  }>
}

/**
 * Regression suite for prompts, tool sets and routing changes: run before and after an
 * optimization to confirm cheaper is not worse.
 */
export async function runEvals(
  makeAgent: () => Agent,
  cases: EvalCase[],
  options: { concurrency?: number; passThreshold?: number } = {},
): Promise<EvalReport> {
  const results = await mapPool(cases, options.concurrency ?? 4, async (c) => {
    try {
      const run = await makeAgent().run(c.task)
      return {
        id: c.id,
        score: await c.grade(run.text),
        turns: run.turns,
        inputTokens: run.usage.inputTokens,
        outputTokens: run.usage.outputTokens,
      }
    } catch (error) {
      return { id: c.id, score: 0, turns: 0, inputTokens: 0, outputTokens: 0, error: String(error) }
    }
  })
  const threshold = options.passThreshold ?? 0.5
  const mean = results.reduce((s, r) => s + r.score, 0) / Math.max(1, results.length)
  return {
    meanScore: mean,
    passRate: results.filter((r) => r.score >= threshold).length / Math.max(1, results.length),
    results,
  }
}
