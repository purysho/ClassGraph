import type { ContentBlock, ModelRequest, ModelResponse, Provider, StopReason } from './types.js'

export interface AnthropicProviderOptions {
  apiKey: string
  baseUrl?: string
  /** Mark the system prompt and tool list as cacheable (prompt caching). */
  promptCaching?: boolean
  fetchImpl?: typeof fetch
}

/** Minimal Messages API client; no SDK dependency. */
export class AnthropicProvider implements Provider {
  readonly name = 'anthropic'
  private readonly fetchImpl: typeof fetch

  constructor(private readonly options: AnthropicProviderOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch
  }

  async complete(request: ModelRequest): Promise<ModelResponse> {
    const cache = this.options.promptCaching !== false
    const tools = request.tools.map((tool, index) => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.inputSchema,
      ...(cache && index === request.tools.length - 1
        ? { cache_control: { type: 'ephemeral' } }
        : {}),
    }))
    const body = {
      model: request.model,
      max_tokens: request.maxTokens,
      system: cache
        ? [{ type: 'text', text: request.system, cache_control: { type: 'ephemeral' } }]
        : request.system,
      tools,
      messages: request.messages.map((m) => ({ role: m.role, content: m.content.map(toWire) })),
    }
    const response = await this.fetchImpl(
      `${this.options.baseUrl ?? 'https://api.anthropic.com'}/v1/messages`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': this.options.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(body),
        signal: request.signal,
      },
    )
    if (!response.ok) {
      throw new ProviderError(`Anthropic API ${response.status}`, response.status)
    }
    const json = (await response.json()) as WireResponse
    return {
      model: json.model,
      stopReason: mapStop(json.stop_reason),
      content: json.content.flatMap(fromWire),
      usage: {
        inputTokens: json.usage.input_tokens,
        outputTokens: json.usage.output_tokens,
        cacheReadTokens: json.usage.cache_read_input_tokens ?? 0,
        cacheWriteTokens: json.usage.cache_creation_input_tokens ?? 0,
      },
    }
  }
}

export class ProviderError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
  }

  get retryable(): boolean {
    return this.status === 429 || this.status === 529 || this.status >= 500
  }
}

/** Retries retryable provider errors with exponential backoff. */
export function withRetry(provider: Provider, attempts = 4, baseDelayMs = 1000): Provider {
  return {
    name: `${provider.name}+retry`,
    async complete(request) {
      for (let attempt = 1; ; attempt += 1) {
        try {
          return await provider.complete(request)
        } catch (error) {
          const retryable = error instanceof ProviderError && error.retryable
          if (!retryable || attempt >= attempts) throw error
          await new Promise((r) => setTimeout(r, baseDelayMs * 2 ** (attempt - 1)))
        }
      }
    },
  }
}

/** Deterministic provider for tests and dry runs: replays scripted responses. */
export class ScriptedProvider implements Provider {
  readonly name = 'scripted'
  readonly requests: ModelRequest[] = []

  constructor(
    private readonly script: Array<
      Partial<ModelResponse> | ((request: ModelRequest) => Partial<ModelResponse>)
    >,
  ) {}

  complete(request: ModelRequest): Promise<ModelResponse> {
    this.requests.push(structuredClone({ ...request, signal: undefined }))
    const next = this.script.shift()
    if (!next) return Promise.reject(new Error('ScriptedProvider: script exhausted'))
    const partial = typeof next === 'function' ? next(request) : next
    const content = partial.content ?? []
    return Promise.resolve({
      model: partial.model ?? request.model,
      content,
      stopReason:
        partial.stopReason ??
        (content.some((b) => b.type === 'tool_use') ? 'tool_use' : 'end_turn'),
      usage: partial.usage ?? {
        inputTokens: 100,
        outputTokens: 20,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
      },
    })
  }
}

interface WireResponse {
  model: string
  stop_reason: string
  content: Array<{ type: string; text?: string; id?: string; name?: string; input?: unknown }>
  usage: {
    input_tokens: number
    output_tokens: number
    cache_read_input_tokens?: number
    cache_creation_input_tokens?: number
  }
}

function toWire(block: ContentBlock): Record<string, unknown> {
  if (block.type === 'tool_result') {
    return {
      type: 'tool_result',
      tool_use_id: block.toolUseId,
      content: block.content,
      is_error: block.isError ?? false,
    }
  }
  return { ...block }
}

function fromWire(block: WireResponse['content'][number]): ContentBlock[] {
  if (block.type === 'text') return [{ type: 'text', text: block.text ?? '' }]
  if (block.type === 'tool_use') {
    return [{ type: 'tool_use', id: block.id ?? '', name: block.name ?? '', input: block.input }]
  }
  return []
}

function mapStop(reason: string): StopReason {
  return reason === 'end_turn' ||
    reason === 'tool_use' ||
    reason === 'max_tokens' ||
    reason === 'refusal'
    ? reason
    : 'other'
}
