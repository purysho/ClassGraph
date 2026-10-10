import { z } from 'zod'
import { extractJson, mapPool } from './concurrency.js'
import type { Agent, RunResult } from './harness.js'
import { addUsage, type Usage } from './types.js'

const PlanSchema = z.object({
  subtasks: z
    .array(
      z.object({
        id: z.string(),
        task: z.string(),
        dependsOn: z.array(z.string()).default([]),
        role: z.string().optional(),
      }),
    )
    .min(1)
    .max(20),
})

export type Plan = z.infer<typeof PlanSchema>
export type Subtask = Plan['subtasks'][number]

export const PLANNER_SYSTEM = `You split a task into independent subtasks for parallel workers.
Reply with JSON only: {"subtasks":[{"id":"s1","task":"...","dependsOn":[],"role":"optional worker role"}]}.
Prefer few, self-contained subtasks. Use dependsOn only when a subtask truly needs another's output.
If the task is small, return a single subtask.`

export interface OrchestratorOptions {
  planner: Agent
  /** Creates (or reuses) a worker for a subtask; lets roles map to differently-tooled agents. */
  worker: (subtask: Subtask) => Agent
  synthesizer?: Agent
  concurrency?: number
  signal?: AbortSignal
}

export interface OrchestratorResult {
  plan: Plan
  outputs: Record<string, RunResult>
  text: string
  usage: Usage
}

/**
 * Planner → parallel workers (in dependency waves) → synthesizer. Pass the same Budget to every
 * agent to cap the whole run.
 */
export async function orchestrate(
  task: string,
  options: OrchestratorOptions,
): Promise<OrchestratorResult> {
  const planRun = await options.planner.run(task, { signal: options.signal })
  const plan = parsePlan(planRun.text)
  let usage = planRun.usage
  const outputs: Record<string, RunResult> = {}
  const pending = new Map(plan.subtasks.map((s) => [s.id, s]))

  while (pending.size > 0) {
    const ready = [...pending.values()].filter((s) => s.dependsOn.every((d) => outputs[d]))
    if (ready.length === 0) throw new Error('Plan has a dependency cycle')
    const results = await mapPool(ready, options.concurrency ?? 4, (subtask) => {
      const context = subtask.dependsOn
        .filter((d) => outputs[d])
        .map((d) => `Result of ${d}:\n${outputs[d]!.text}`)
        .join('\n\n')
      const prompt = context
        ? `${subtask.task}\n\nContext from earlier subtasks:\n${context}`
        : subtask.task
      return options.worker(subtask).run(prompt, { signal: options.signal })
    })
    ready.forEach((subtask, i) => {
      outputs[subtask.id] = results[i]!
      usage = addUsage(usage, results[i]!.usage)
      pending.delete(subtask.id)
    })
  }

  let text: string
  if (options.synthesizer && plan.subtasks.length > 1) {
    const parts = plan.subtasks
      .map((s) => `## ${s.id}: ${s.task}\n${outputs[s.id]!.text}`)
      .join('\n\n')
    const synth = await options.synthesizer.run(
      `Original task:\n${task}\n\nWorker results:\n${parts}\n\nCombine these into one final answer.`,
      { signal: options.signal },
    )
    usage = addUsage(usage, synth.usage)
    text = synth.text
  } else {
    text = plan.subtasks.map((s) => outputs[s.id]!.text).join('\n\n')
  }
  return { plan, outputs, text, usage }
}

export function parsePlan(text: string): Plan {
  const plan = PlanSchema.parse(extractJson(text))
  const ids = new Set(plan.subtasks.map((s) => s.id))
  if (ids.size !== plan.subtasks.length) throw new Error('Plan has duplicate subtask ids')
  for (const s of plan.subtasks) {
    for (const d of s.dependsOn)
      if (!ids.has(d)) throw new Error(`Subtask ${s.id} depends on unknown ${d}`)
  }
  return plan
}
