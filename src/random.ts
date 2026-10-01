function fnv1a32(input: string): number {
  let hash = 0x811c9dc5
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

function mix32(value: number): number {
  let x = value >>> 0
  x ^= x >>> 16
  x = Math.imul(x, 0x7feb352d)
  x ^= x >>> 15
  x = Math.imul(x, 0x846ca68b)
  x ^= x >>> 16
  return x >>> 0
}

export function deterministicUnit(seed: string, key: string): number {
  return mix32(fnv1a32(`${seed}\u0000${key}`)) / 0x100000000
}

export function deterministicInt(seed: string, key: string, min: number, max: number): number {
  if (!Number.isInteger(min) || !Number.isInteger(max) || min > max) {
    throw new Error('CG-9001 invalid integer random range')
  }
  return min + Math.floor(deterministicUnit(seed, key) * (max - min + 1))
}

export function deterministicNormal(seed: string, key: string): number {
  const u1 = Math.max(deterministicUnit(seed, `${key}:u1`), Number.EPSILON)
  const u2 = deterministicUnit(seed, `${key}:u2`)
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
}
