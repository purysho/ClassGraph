function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (typeof value !== 'object' || value === null) return value

  const record = value as Record<string, unknown>
  return Object.fromEntries(
    Object.keys(record)
      .sort((left, right) => left.localeCompare(right))
      .map((key) => [key, canonicalize(record[key])]),
  )
}

export function stableJson(value: unknown): string {
  return JSON.stringify(canonicalize(value))
}

export function deterministicId(prefix: string, value: unknown): string {
  const text = stableJson(value)
  let hash = 0xcbf29ce484222325n

  for (const character of text) {
    hash ^= BigInt(character.codePointAt(0) ?? 0)
    hash = BigInt.asUintN(64, hash * 0x100000001b3n)
  }

  return `${prefix}-${hash.toString(16).padStart(16, '0')}`
}
