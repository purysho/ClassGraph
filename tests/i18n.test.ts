import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it } from 'vitest'
import { setUiLanguage, tr, trn, trServer } from '../src/i18n.js'
import { translateServerMessage, ZH_SERVER_PATTERNS } from '../src/i18n-zh-server.js'
import { ZH } from '../src/i18n-zh.js'

const CLIENT = readFileSync(new URL('../src/app-client.ts', import.meta.url), 'utf8')

/** Reads a single-quoted TypeScript string literal starting at `start` (the opening quote). */
function literalAt(source: string, start: number): { value: string; end: number } | null {
  if (source[start] !== "'") return null
  let value = ''
  for (let index = start + 1; index < source.length; index += 1) {
    const char = source[index]!
    if (char === '\\') {
      const next = source[index + 1]!
      value += next === 'n' ? '\n' : next
      index += 1
    } else if (char === "'") {
      return { value, end: index + 1 }
    } else {
      value += char
    }
  }
  return null
}

function keysIn(source: string): { keys: Set<string>; nonLiteral: string[] } {
  const keys = new Set<string>()
  const nonLiteral: string[] = []
  for (const match of source.matchAll(/\btrn?\(\s*/g)) {
    const start = match.index + match[0].length
    const first = literalAt(source, start)
    if (!first) {
      nonLiteral.push(source.slice(match.index, match.index + 60))
      continue
    }
    if (match[0].startsWith('trn')) {
      const rest = /^\s*,\s*/.exec(source.slice(first.end))
      const second = rest ? literalAt(source, first.end + rest[0].length) : null
      if (!second) nonLiteral.push(source.slice(match.index, match.index + 60))
      else keys.add(second.value)
    } else {
      keys.add(first.value)
    }
  }
  return { keys, nonLiteral }
}

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()

afterEach(() => setUiLanguage('en'))

describe('Chinese interface text', () => {
  const { keys, nonLiteral } = keysIn(CLIENT)

  it('only translates string literals, so every key can be checked', () => {
    expect(nonLiteral).toEqual([])
  })

  it('has a Chinese entry for every tr() and trn() in the app', () => {
    expect([...keys].filter((key) => !(key in ZH))).toEqual([])
  })

  it('keeps the same placeholders and markup in each entry', () => {
    const problems: string[] = []
    for (const [english, chinese] of Object.entries(ZH)) {
      if (placeholders(english).join() !== placeholders(chinese).join()) problems.push(english)
      const tags = (text: string) => (text.match(/<\/?[a-z]+/g) ?? []).sort().join()
      if (tags(english) !== tags(chinese)) problems.push(english)
    }
    expect(problems).toEqual([])
  })

  it('has no entries the app no longer uses', () => {
    expect(Object.keys(ZH).filter((key) => !keys.has(key))).toEqual([])
  })

  it('translates, fills placeholders and falls back to English', () => {
    setUiLanguage('zh')
    expect(tr('Students')).toBe(ZH.Students)
    expect(tr('A sentence that has no entry {x}', { x: 1 })).toBe('A sentence that has no entry 1')
    setUiLanguage('en')
    expect(trn('{n} student', '{n} students', 1)).toBe('1 student')
    expect(trn('{n} student', '{n} students', 3)).toBe('3 students')
  })
})

describe('Chinese for messages written by the analysis code', () => {
  const samples = [
    '"abc" is not a number',
    '"maybe" is not yes/no',
    '"red" is not one of the categories (blue, green)',
    '"E" is not on the scale (A, B, C)',
    'Only one column can be the student-id.',
    'Updating an existing class needs a student ID column to match students.',
    'Choose at least one column to import.',
    'Two columns use the metric key "score".',
    'Metric key "score" already exists as a number metric.',
    'Metric "score" is not in this class.',
    'Every imported metric needs a label.',
    'A category metric needs at least one category.',
    'An ordinal metric needs its scale in order.',
    'This row has no student ID.',
    'Student ID "s1" also appears on row 4.',
    'The sheet has no student rows.',
    'Create a room before generating seating candidates.',
    'Enabled capacity is 30 seats for 36 students.',
    'Required assignment references unknown student s9.',
    'Required seat seat-r1-c1 is not enabled.',
    'Rule r1 requires seat tag "front", but no enabled seat has that tag.',
    's1 is fixed to seat-r1-c1.',
    's1 must be fixed to seat-r1-c1.',
    's1 is in a seat tagged front.',
    's1 is not in a seat tagged front.',
    's1 requires a seat tagged front.',
    's1 and s2 are not orthogonal neighbours.',
    's1 and s2 must not be king neighbours.',
    'Seat distance is 2.00.',
    'One or both students are not assigned.',
    'Row mean spread is 3.50; 2 assignment(s) lacked a recorded value and were ignored.',
    'All hard constraints are satisfied.',
    'No soft objectives are selected; candidates differ only by seeded arrangement.',
    'No arrangement satisfied every hard constraint in 200 deterministic attempts.',
    'Hard rule r1 was violated in 12 of 200 tested arrangements.',
    'pair-distance (r2) penalty 1.50: Seat distance is 3.00.',
    'Largest-smallest group size difference is 1.',
    'Group mean spread for score is 4.25; 1 student(s) lacked a recorded value and were ignored.',
  ]

  it('translates every known message shape, and each pattern is exercised', () => {
    const used = new Set<RegExp>()
    for (const sample of samples) {
      const translated = translateServerMessage(sample)
      expect(translated, sample).not.toBe(sample)
      expect(translated, sample).toMatch(/[一-鿿]/)
      for (const [pattern] of ZH_SERVER_PATTERNS) if (pattern.test(sample)) used.add(pattern)
    }
    expect(ZH_SERVER_PATTERNS.filter(([pattern]) => !used.has(pattern)).map(String)).toEqual([])
    expect(translateServerMessage('pair-distance (r2) penalty 1.50: Seat distance is 3.00.')).toBe(
      'pair-distance（r2）惩罚分 1.50：座位距离为 3.00。',
    )
  })

  it('leaves messages in English unless the interface is Chinese', () => {
    expect(trServer('This row has no student ID.')).toBe('This row has no student ID.')
    setUiLanguage('zh')
    expect(trServer('This row has no student ID.')).toBe('这一行没有学号。')
    expect(trServer('Something new')).toBe('Something new')
  })
})
