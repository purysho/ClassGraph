/**
 * ClassGraph's interface language: English or Simplified Chinese.
 *
 * The English text is the key. `tr('Save')` returns the Chinese when the interface is in Chinese
 * and an entry exists, and the English otherwise, so a missing entry shows English rather than a
 * blank. Translations are written by hand, once; nothing is machine-translated at run time.
 * tests/i18n.test.ts checks that every tr() and trn() in the app has an entry.
 *
 * Entries may contain HTML markup when the English does (for example `<b>…</b>`). Values passed
 * as `{placeholders}` are inserted as given, so callers escape them where they end up in HTML.
 */
import { ZH } from './i18n-zh.js'
import { ZH_ERRORS } from './i18n-zh-errors.js'
import { translateServerMessage } from './i18n-zh-server.js'

export type UiLanguage = 'en' | 'zh'
export type TrVars = Record<string, string | number>

let current: UiLanguage = 'en'

export function setUiLanguage(language: UiLanguage): void {
  current = language
}

export function uiLanguage(): UiLanguage {
  return current
}

/** Locale for dates and numbers in the current interface language. */
export function uiLocale(): string {
  return current === 'zh' ? 'zh-CN' : 'en-GB'
}

/** The language to use when the teacher has not chosen one. */
export function languageFromLocale(locale: string | undefined | null): UiLanguage {
  return /^zh/i.test(locale ?? '') ? 'zh' : 'en'
}

function fill(text: string, vars?: TrVars): string {
  if (!vars) return text
  return text.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.hasOwn(vars, name) ? String(vars[name]) : match,
  )
}

export function tr(text: string, vars?: TrVars): string {
  return fill(current === 'zh' ? (ZH[text] ?? text) : text, vars)
}

/** Singular/plural. Chinese has one form, keyed by the plural English. */
export function trn(one: string, other: string, count: number, vars?: TrVars): string {
  const all = { n: count, ...vars }
  if (current === 'zh') return fill(ZH[other] ?? (count === 1 ? one : other), all)
  return fill(count === 1 ? one : other, all)
}

/**
 * Makes an error from ClassGraph readable in the interface language. Errors carry a CG-xxxx code;
 * in Chinese the code's summary is shown first and the original English detail is kept after it,
 * so nothing a teacher might need to report is lost.
 */
export function localizeError(message: string): string {
  if (current !== 'zh') return message
  const code = /\bCG-\d{4}\b/.exec(message)?.[0]
  const summary = code ? ZH_ERRORS[code] : undefined
  if (!code || !summary) return message
  const detail = message
    .replaceAll(code, '')
    .replace(/^[\s:：-]+/, '')
    .trim()
  return detail ? `${summary}（${code}）\n英文详情：${detail}` : `${summary}（${code}）`
}

/** Shows an English message from ClassGraph's analysis or planning code in the interface language. */
export function trServer(message: string): string {
  return current === 'zh' ? translateServerMessage(message) : message
}
