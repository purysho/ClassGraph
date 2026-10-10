import type { AgentEvent } from './harness.js'
import { addUsage, emptyUsage, type Usage } from './types.js'

export interface TraceSummary {
  modelCalls: number
  toolCalls: number
  toolFailures: number
  toolMs: Record<string, number>
  usageByAgent: Record<string, Usage>
}

/** Collects agent events; pass `tracer.handle` as `onEvent` to every agent in a run. */
export class Tracer {
  readonly events: Array<AgentEvent & { at: number }> = []
  constructor(private readonly sink?: (event: AgentEvent) => void) {}

  handle = (event: AgentEvent): void => {
    this.events.push({ ...event, at: Date.now() })
    this.sink?.(event)
  }

  summary(): TraceSummary {
    const summary: TraceSummary = {
      modelCalls: 0,
      toolCalls: 0,
      toolFailures: 0,
      toolMs: {},
      usageByAgent: {},
    }
    for (const event of this.events) {
      if (event.type === 'model_response') {
        summary.modelCalls += 1
        summary.usageByAgent[event.agent] = addUsage(
          summary.usageByAgent[event.agent] ?? emptyUsage(),
          event.usage,
        )
      } else if (event.type === 'tool_end') {
        summary.toolCalls += 1
        if (!event.ok) summary.toolFailures += 1
        summary.toolMs[event.tool] = (summary.toolMs[event.tool] ?? 0) + event.ms
      }
    }
    return summary
  }
}
