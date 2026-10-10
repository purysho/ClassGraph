import { estimateTokens, type Message } from './types.js'

export interface CompactionOptions {
  /** Start compacting once the estimated history size passes this many tokens. */
  maxTokens: number
  /** Most recent messages always kept verbatim. */
  keepRecent?: number
  /** Tool results longer than this (chars) are clipped in older turns. */
  clipToolResultChars?: number
}

export function estimateMessagesTokens(messages: Message[]): number {
  return estimateTokens(JSON.stringify(messages))
}

/**
 * Cheap, model-free compaction: clips large tool outputs in older turns first (usually the
 * bulk of context), then drops the oldest exchanges while keeping the original task.
 * Tool-use / tool-result pairs are never split.
 */
export function compactMessages(messages: Message[], options: CompactionOptions): Message[] {
  if (estimateMessagesTokens(messages) <= options.maxTokens) return messages
  const keepRecent = options.keepRecent ?? 6
  const clip = options.clipToolResultChars ?? 400
  const boundary = Math.max(1, messages.length - keepRecent)

  let result = messages.map((message, index) => {
    if (index === 0 || index >= boundary) return message
    return {
      ...message,
      content: message.content.map((block) =>
        block.type === 'tool_result' && block.content.length > clip
          ? {
              ...block,
              content: `${block.content.slice(0, clip)}\n…[clipped ${block.content.length - clip} chars]`,
            }
          : block,
      ),
    }
  })

  while (estimateMessagesTokens(result) > options.maxTokens && result.length > keepRecent + 1) {
    // Drop the oldest assistant/user pair after the first message so roles keep alternating
    // and every tool_result still follows its tool_use.
    result = [result[0]!, ...result.slice(3)]
    const first = result[0]!
    result[0] = {
      ...first,
      content: [
        ...first.content.filter((b) => !(b.type === 'text' && b.text.startsWith('[Earlier'))),
        { type: 'text', text: '[Earlier steps were removed to save context.]' },
      ],
    }
  }
  return result
}
