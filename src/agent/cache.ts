import { createHash } from 'node:crypto'
import type { ModelRequest, ModelResponse, Provider } from './types.js'

export interface CacheStore {
  get(key: string): ModelResponse | undefined
  set(key: string, value: ModelResponse): void
}

export class MemoryCacheStore implements CacheStore {
  private readonly map = new Map<string, ModelResponse>()
  constructor(private readonly maxEntries = 500) {}

  get(key: string): ModelResponse | undefined {
    const hit = this.map.get(key)
    if (hit) {
      this.map.delete(key)
      this.map.set(key, hit)
    }
    return hit
  }

  set(key: string, value: ModelResponse): void {
    this.map.set(key, value)
    if (this.map.size > this.maxEntries) this.map.delete(this.map.keys().next().value as string)
  }
}

/**
 * Exact-match response cache: identical requests (same model, prompt, tools, history) are
 * served without a model call. Cached hits report zero usage so budgets stay honest.
 */
export function withResponseCache(
  provider: Provider,
  store: CacheStore = new MemoryCacheStore(),
): Provider & { hits: number } {
  const wrapped = {
    name: `${provider.name}+cache`,
    hits: 0,
    async complete(request: ModelRequest): Promise<ModelResponse> {
      const key = requestKey(request)
      const hit = store.get(key)
      if (hit) {
        wrapped.hits += 1
        return {
          ...structuredClone(hit),
          usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 },
        }
      }
      const response = await provider.complete(request)
      if (response.stopReason !== 'max_tokens') store.set(key, structuredClone(response))
      return response
    },
  }
  return wrapped
}

export function requestKey(request: ModelRequest): string {
  const { model, system, messages, tools, maxTokens } = request
  return createHash('sha256')
    .update(JSON.stringify({ model, system, messages, tools, maxTokens }))
    .digest('hex')
}
