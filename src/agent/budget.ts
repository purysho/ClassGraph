import { addUsage, emptyUsage, type Usage } from './types.js'

/** USD per million tokens. Supply current prices from your provider's pricing page. */
export interface ModelPrice {
  input: number
  output: number
  cacheRead?: number
  cacheWrite?: number
}

export interface BudgetLimits {
  maxCostUsd?: number
  maxInputTokens?: number
  maxOutputTokens?: number
  maxTurns?: number
  maxWallMs?: number
}

export class BudgetExceededError extends Error {
  constructor(readonly reason: string) {
    super(`Budget exceeded: ${reason}`)
  }
}

/**
 * Shared spend tracker. One instance can be passed to many agents so a whole multi-agent run
 * stays under a single ceiling.
 */
export class Budget {
  usage: Usage = emptyUsage()
  costUsd = 0
  turns = 0
  private readonly startedAt = Date.now()

  constructor(
    readonly limits: BudgetLimits = {},
    private readonly prices: Record<string, ModelPrice> = {},
  ) {}

  record(model: string, usage: Usage): void {
    this.usage = addUsage(this.usage, usage)
    this.turns += 1
    this.costUsd += costOf(usage, this.prices[model])
  }

  /** Throws when a limit is already reached; call before every model request. */
  check(): void {
    const { limits } = this
    if (limits.maxCostUsd !== undefined && this.costUsd >= limits.maxCostUsd) {
      throw new BudgetExceededError(`cost $${this.costUsd.toFixed(4)}`)
    }
    if (limits.maxInputTokens !== undefined && this.usage.inputTokens >= limits.maxInputTokens) {
      throw new BudgetExceededError('input tokens')
    }
    if (limits.maxOutputTokens !== undefined && this.usage.outputTokens >= limits.maxOutputTokens) {
      throw new BudgetExceededError('output tokens')
    }
    if (limits.maxTurns !== undefined && this.turns >= limits.maxTurns) {
      throw new BudgetExceededError('turns')
    }
    if (limits.maxWallMs !== undefined && Date.now() - this.startedAt >= limits.maxWallMs) {
      throw new BudgetExceededError('wall time')
    }
  }

  /** Fraction of the cost ceiling used, or 0 when no ceiling is set. */
  pressure(): number {
    return this.limits.maxCostUsd ? this.costUsd / this.limits.maxCostUsd : 0
  }
}

export function costOf(usage: Usage, price: ModelPrice | undefined): number {
  if (!price) return 0
  const perToken = (n: number, p: number) => (n * p) / 1_000_000
  return (
    perToken(usage.inputTokens, price.input) +
    perToken(usage.outputTokens, price.output) +
    perToken(usage.cacheReadTokens, price.cacheRead ?? price.input * 0.1) +
    perToken(usage.cacheWriteTokens, price.cacheWrite ?? price.input * 1.25)
  )
}

export interface ModelTier {
  model: string
  /** Rough capability rank; higher handles harder work. */
  rank: number
}

/**
 * Routes each request to the cheapest tier that fits: easy tasks go to the small model, hard
 * tasks or retries escalate, and budget pressure pushes back down.
 */
export class ModelRouter {
  private readonly tiers: ModelTier[]

  constructor(tiers: ModelTier[]) {
    if (tiers.length === 0) throw new Error('ModelRouter needs at least one tier')
    this.tiers = [...tiers].sort((a, b) => a.rank - b.rank)
  }

  pick(options: { difficulty: number; escalations?: number; budget?: Budget }): string {
    let index = Math.round(Math.min(1, Math.max(0, options.difficulty)) * (this.tiers.length - 1))
    index += options.escalations ?? 0
    if (options.budget && options.budget.pressure() > 0.8) index -= 1
    index = Math.min(this.tiers.length - 1, Math.max(0, index))
    return this.tiers[index]!.model
  }
}

/** Heuristic difficulty score in [0,1] for routing without spending a model call. */
export function estimateDifficulty(task: string): number {
  let score = Math.min(0.4, task.length / 4000)
  if (/\b(design|architect|prove|debug|refactor|analy[sz]e|research|plan|security)\b/i.test(task)) {
    score += 0.35
  }
  if (/\b(list|format|rename|summari[sz]e|translate|extract|classify)\b/i.test(task)) score -= 0.15
  return Math.min(1, Math.max(0, score))
}
