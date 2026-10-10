import { z } from 'zod'
import type { ToolSpec } from './types.js'

export type RiskLevel = 'read' | 'write' | 'external' | 'destructive'

export interface ToolContext {
  signal?: AbortSignal
  agentName: string
}

export interface Tool<I = unknown> {
  name: string
  description: string
  input: z.ZodType<I>
  risk: RiskLevel
  /** Free-form tags used by the tool selector (e.g. "web", "files"). */
  tags?: string[]
  /** Output from this tool comes from outside the trust boundary (web, email, files). */
  untrustedOutput?: boolean
  run(input: I, context: ToolContext): Promise<string>
}

export function defineTool<I>(tool: Tool<I>): Tool {
  return tool
}

export class ToolRegistry {
  private readonly tools = new Map<string, Tool>()

  constructor(tools: Tool[] = []) {
    for (const tool of tools) this.register(tool)
  }

  register(tool: Tool): void {
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(tool.name)) throw new Error(`Invalid tool name ${tool.name}`)
    if (this.tools.has(tool.name)) throw new Error(`Duplicate tool ${tool.name}`)
    this.tools.set(tool.name, tool)
  }

  get(name: string): Tool | undefined {
    return this.tools.get(name)
  }

  list(): Tool[] {
    return [...this.tools.values()]
  }

  specs(names?: string[]): ToolSpec[] {
    const tools = names ? names.flatMap((n) => this.tools.get(n) ?? []) : this.list()
    return tools.map(toSpec)
  }
}

export function toSpec(tool: Tool): ToolSpec {
  const schema = z.toJSONSchema(tool.input) as Record<string, unknown>
  delete schema.$schema
  return { name: tool.name, description: tool.description, inputSchema: schema }
}

/**
 * Picks the few tools relevant to a task so the model is not sent every schema on every turn
 * (tool definitions are input tokens). Lexical scoring keeps it free; swap in an embedding
 * scorer if the catalogue grows large.
 */
export function selectTools(
  registry: ToolRegistry,
  task: string,
  options: { limit?: number; always?: string[] } = {},
): string[] {
  const limit = options.limit ?? 8
  const words = tokenize(task)
  const scored = registry
    .list()
    .map((tool) => {
      const haystack = new Set(
        tokenize(`${tool.name} ${tool.description} ${(tool.tags ?? []).join(' ')}`),
      )
      let score = 0
      for (const word of words) if (haystack.has(word)) score += 1
      return { name: tool.name, score }
    })
    .filter((t) => t.score > 0)
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
  const always = (options.always ?? []).filter((n) => registry.get(n))
  const picked = [...always]
  for (const { name } of scored) {
    if (picked.length >= limit) break
    if (!picked.includes(name)) picked.push(name)
  }
  return picked
}

const STOP = new Set([
  'the',
  'a',
  'an',
  'and',
  'or',
  'of',
  'to',
  'in',
  'for',
  'on',
  'with',
  'is',
  'it',
])

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 1 && !STOP.has(w))
    .map((w) => (w.length > 4 && w.endsWith('s') ? w.slice(0, -1) : w))
}
