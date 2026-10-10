/** Runs `worker` over `items` with at most `limit` in flight; results keep input order. */
export async function mapPool<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let next = 0
  const lanes = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (next < items.length) {
      const index = next++
      results[index] = await worker(items[index]!, index)
    }
  })
  await Promise.all(lanes)
  return results
}

/** Pulls the first JSON object or array out of model text (tolerates prose and code fences). */
export function extractJson(text: string): unknown {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text)
  const candidate = fenced ? fenced[1]! : text
  const start = candidate.search(/[[{]/)
  if (start < 0) throw new Error('No JSON found in model output')
  const open = candidate[start]
  const close = open === '{' ? '}' : ']'
  const end = candidate.lastIndexOf(close)
  if (end < start) throw new Error('Unterminated JSON in model output')
  return JSON.parse(candidate.slice(start, end + 1))
}
