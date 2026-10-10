import { z } from 'zod'
import { extractJson } from './concurrency.js'
import type { Agent, RunResult } from './harness.js'
import { addUsage, type Usage } from './types.js'

const VerdictSchema = z.object({
  pass: z.boolean(),
  score: z.number().min(0).max(10),
  issues: z.array(z.string()).default([]),
})

export type Verdict = z.infer<typeof VerdictSchema>

export const REVIEWER_SYSTEM = `You are a strict reviewer. Check the answer against the task and rubric.
Look for factual errors, unsupported claims, missing requirements, unsafe or non-compliant content.
Reply with JSON only: {"pass":true|false,"score":0-10,"issues":["specific, actionable issue"]}.`

export interface ReviewLoopOptions {
  worker: Agent
  reviewer: Agent
  rubric?: string
  /** Revision rounds after the first attempt. */
  maxRevisions?: number
  /** Minimum score to accept even if the reviewer did not set pass. */
  passScore?: number
  /** Escalate the worker's routed model one tier per failed review. */
  escalate?: boolean
  /** Cheap deterministic checks run before spending a reviewer call. */
  checks?: Array<(text: string) => string | null>
  signal?: AbortSignal
}

export interface ReviewLoopResult {
  final: RunResult
  verdicts: Verdict[]
  accepted: boolean
  rounds: number
  usage: Usage
}

/** Generate → review → revise until accepted or out of rounds. */
export async function reviewLoop(
  task: string,
  options: ReviewLoopOptions,
): Promise<ReviewLoopResult> {
  const maxRevisions = options.maxRevisions ?? 2
  const verdicts: Verdict[] = []
  let prompt = task
  let final = await options.worker.run(prompt, { signal: options.signal })
  let usage = final.usage

  for (let round = 0; ; round += 1) {
    const checkIssues = (options.checks ?? []).flatMap((check) => check(final.text) ?? [])
    let verdict: Verdict
    if (checkIssues.length) {
      verdict = { pass: false, score: 0, issues: checkIssues }
    } else {
      const review = await options.reviewer.run(
        `Task:\n${task}\n\n${options.rubric ? `Rubric:\n${options.rubric}\n\n` : ''}Answer to review:\n${final.text}`,
        { signal: options.signal },
      )
      usage = addUsage(usage, review.usage)
      verdict = parseVerdict(review.text)
    }
    verdicts.push(verdict)
    const accepted = verdict.pass || verdict.score >= (options.passScore ?? 8)
    if (accepted || round >= maxRevisions) {
      return { final, verdicts, accepted, rounds: round + 1, usage }
    }
    prompt = `${task}\n\nYour previous answer:\n${final.text}\n\nA reviewer found these issues; fix all of them:\n${verdict.issues.map((i) => `- ${i}`).join('\n')}`
    final = await options.worker.run(prompt, {
      signal: options.signal,
      escalations: options.escalate ? round + 1 : 0,
    })
    usage = addUsage(usage, final.usage)
  }
}

export function parseVerdict(text: string): Verdict {
  try {
    return VerdictSchema.parse(extractJson(text))
  } catch {
    return { pass: false, score: 0, issues: ['Reviewer output was not valid JSON; review again.'] }
  }
}
