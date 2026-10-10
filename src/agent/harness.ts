import { Budget, BudgetExceededError, estimateDifficulty, type ModelRouter } from './budget.js'
import { compactMessages, type CompactionOptions } from './context.js'
import { detectInjection, redact, SafetyGuard, wrapUntrusted } from './safety.js'
import { selectTools, type Tool, type ToolRegistry } from './tools.js'
import {
  addUsage,
  emptyUsage,
  textOf,
  type ContentBlock,
  type Message,
  type Provider,
  type ToolResultBlock,
  type ToolUseBlock,
  type Usage,
} from './types.js'

export type AgentEvent =
  | { type: 'model_request'; agent: string; model: string; turn: number }
  | { type: 'model_response'; agent: string; usage: Usage; stopReason: string }
  | { type: 'tool_start'; agent: string; tool: string; input: unknown }
  | { type: 'tool_end'; agent: string; tool: string; ok: boolean; ms: number }
  | { type: 'done'; agent: string; stopReason: RunStopReason }

export interface AgentConfig {
  name: string
  system: string
  provider: Provider
  /** Fixed model, or a router that picks per run from task difficulty. */
  model: string | ModelRouter
  tools?: ToolRegistry
  /** Explicit tool subset; otherwise tools are auto-selected from the task. */
  toolNames?: string[]
  toolSelection?: { limit?: number; always?: string[] }
  guard?: SafetyGuard
  budget?: Budget
  maxTurns?: number
  maxTokens?: number
  compaction?: CompactionOptions
  /** Redact secrets/PII from the task and tool results before they reach the model. */
  redactOutbound?: boolean
  toolTimeoutMs?: number
  onEvent?: (event: AgentEvent) => void
}

export type RunStopReason =
  'completed' | 'max_turns' | 'budget' | 'refusal' | 'aborted' | 'max_tokens'

export interface RunResult {
  text: string
  stopReason: RunStopReason
  messages: Message[]
  usage: Usage
  turns: number
  model: string
}

export interface RunOptions {
  signal?: AbortSignal
  /** Bump the routed model up this many tiers (used on review retries). */
  escalations?: number
  history?: Message[]
}

export class Agent {
  readonly guard: SafetyGuard
  readonly budget: Budget

  constructor(readonly config: AgentConfig) {
    this.guard = config.guard ?? new SafetyGuard()
    this.budget = config.budget ?? new Budget()
  }

  async run(task: string, options: RunOptions = {}): Promise<RunResult> {
    const { config } = this
    const emit = (event: AgentEvent) => config.onEvent?.(event)
    const model =
      typeof config.model === 'string'
        ? config.model
        : config.model.pick({
            difficulty: estimateDifficulty(task),
            escalations: options.escalations,
            budget: this.budget,
          })
    const toolNames =
      config.toolNames ??
      (config.tools ? selectTools(config.tools, task, config.toolSelection) : [])
    const tools = config.tools?.specs(toolNames) ?? []

    const outboundTask = config.redactOutbound ? this.redactLogged(task, 'task') : task
    let messages: Message[] = [
      ...(options.history ?? []),
      { role: 'user', content: [{ type: 'text', text: outboundTask }] },
    ]
    let usage = emptyUsage()
    let lastText = ''

    const finish = (stopReason: RunStopReason, turns: number): RunResult => {
      emit({ type: 'done', agent: config.name, stopReason })
      return { text: lastText, stopReason, messages, usage, turns, model }
    }

    const maxTurns = config.maxTurns ?? 20
    for (let turn = 1; turn <= maxTurns; turn += 1) {
      if (options.signal?.aborted) return finish('aborted', turn - 1)
      try {
        this.budget.check()
      } catch (error) {
        if (error instanceof BudgetExceededError) return finish('budget', turn - 1)
        throw error
      }
      if (config.compaction) messages = compactMessages(messages, config.compaction)

      emit({ type: 'model_request', agent: config.name, model, turn })
      const response = await config.provider.complete({
        model,
        system: config.system,
        messages,
        tools,
        maxTokens: config.maxTokens ?? 4096,
        signal: options.signal,
      })
      usage = addUsage(usage, response.usage)
      this.budget.record(response.model, response.usage)
      emit({
        type: 'model_response',
        agent: config.name,
        usage: response.usage,
        stopReason: response.stopReason,
      })
      messages.push({ role: 'assistant', content: response.content })
      const text = textOf(response.content)
      if (text) lastText = text

      if (response.stopReason === 'refusal') return finish('refusal', turn)
      const calls = response.content.filter((b): b is ToolUseBlock => b.type === 'tool_use')
      if (calls.length === 0) {
        return finish(response.stopReason === 'max_tokens' ? 'max_tokens' : 'completed', turn)
      }
      const results = await this.runTools(calls, options.signal)
      messages.push({ role: 'user', content: results })
    }
    return finish('max_turns', maxTurns)
  }

  private async runTools(calls: ToolUseBlock[], signal?: AbortSignal): Promise<ContentBlock[]> {
    const resolved = calls.map((call) => ({ call, tool: this.config.tools?.get(call.name) }))
    // Read-only calls are independent and safe to run concurrently; anything with side effects
    // runs in the order the model asked for.
    if (resolved.every(({ tool }) => tool?.risk === 'read')) {
      return Promise.all(resolved.map(({ call, tool }) => this.runTool(call, tool, signal)))
    }
    const results: ToolResultBlock[] = []
    for (const { call, tool } of resolved) results.push(await this.runTool(call, tool, signal))
    return results
  }

  private async runTool(
    call: ToolUseBlock,
    tool: Tool | undefined,
    signal?: AbortSignal,
  ): Promise<ToolResultBlock> {
    const agent = this.config.name
    const fail = (content: string): ToolResultBlock => ({
      type: 'tool_result',
      toolUseId: call.id,
      content,
      isError: true,
    })
    if (!tool) return fail(`Unknown tool: ${call.name}`)
    const parsed = tool.input.safeParse(call.input)
    if (!parsed.success) return fail(`Invalid input: ${parsed.error.message}`)
    const auth = await this.guard.authorize(tool, parsed.data, agent)
    if (!auth.ok) return fail(`Not permitted by policy (${auth.reason}). Try another approach.`)

    this.config.onEvent?.({ type: 'tool_start', agent, tool: tool.name, input: parsed.data })
    const started = Date.now()
    try {
      let output = await withTimeout(
        tool.run(parsed.data, { signal, agentName: agent }),
        this.config.toolTimeoutMs ?? 60_000,
      )
      if (this.config.redactOutbound) output = this.redactLogged(output, tool.name)
      if (tool.untrustedOutput) {
        const flags = detectInjection(output)
        if (flags.length) {
          this.guard.audit.add({
            agent,
            kind: 'injection_flag',
            tool: tool.name,
            detail: flags.join('; '),
          })
        }
        output = wrapUntrusted(tool.name, output, flags)
      }
      this.config.onEvent?.({
        type: 'tool_end',
        agent,
        tool: tool.name,
        ok: true,
        ms: Date.now() - started,
      })
      return { type: 'tool_result', toolUseId: call.id, content: output }
    } catch (error) {
      this.config.onEvent?.({
        type: 'tool_end',
        agent,
        tool: tool.name,
        ok: false,
        ms: Date.now() - started,
      })
      return fail(`Tool error: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  private redactLogged(text: string, where: string): string {
    const { text: out, found } = redact(text)
    if (found.length) {
      this.guard.audit.add({
        agent: this.config.name,
        kind: 'redaction',
        detail: `${where}: ${[...new Set(found)].join(', ')}`,
      })
    }
    return out
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}
