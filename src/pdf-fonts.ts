import fontkit from '@pdf-lib/fontkit'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ClassGraphExportError } from './export-errors.js'
import {
  drawSyntheticBoldText,
  pdfStandardFonts,
  type PdfDocumentAdapter,
  type PdfFontAdapter,
  type PdfPageAdapter,
} from './pdf-runtime.js'

/**
 * Font selection for PDF exports.
 *
 * Documents whose text fits the built-in Latin (WinAnsi) PDF fonts keep using Helvetica, so
 * existing English-only exports are unchanged. Anything else (for example Chinese names) embeds
 * the bundled Noto Sans SC subset; pdf-lib subsets it again so each PDF only carries the glyphs
 * it uses. Characters neither font can draw fail with CG-5004 instead of being dropped.
 */

const UNICODE_FONT_FILE = 'NotoSansSC-Regular-ClassGraph.ttf'

export interface ReportFont {
  pdf: PdfFontAdapter
  syntheticBold: boolean
  /** Characters in `text` this font cannot draw (whitespace ignored). */
  missingCharacters(text: string): string[]
}

export interface ReportFonts {
  regular: ReportFont
  bold: ReportFont
  unicode: boolean
}

interface GlyphSource {
  hasGlyphForCodePoint(codePoint: number): boolean
}

let unicodeFontCache: { bytes: Uint8Array; glyphs: GlyphSource } | null = null

function assetDirectoryCandidates(): string[] {
  const candidates: string[] = []
  if (process.env.CLASSGRAPH_ASSETS_DIR) candidates.push(process.env.CLASSGRAPH_ASSETS_DIR)
  try {
    candidates.push(fileURLToPath(new URL('../assets', import.meta.url)))
  } catch {
    // import.meta.url is unavailable in the bundled CommonJS desktop entry point.
  }
  candidates.push(join(process.cwd(), 'assets'))
  return candidates
}

function loadUnicodeFont(): { bytes: Uint8Array; glyphs: GlyphSource } {
  if (unicodeFontCache) return unicodeFontCache
  for (const directory of assetDirectoryCandidates()) {
    try {
      const bytes = new Uint8Array(readFileSync(join(directory, 'fonts', UNICODE_FONT_FILE)))
      const glyphs = (fontkit as unknown as { create(data: Uint8Array): GlyphSource }).create(bytes)
      unicodeFontCache = { bytes, glyphs }
      return unicodeFontCache
    } catch {
      // Try the next candidate location.
    }
  }
  throw new ClassGraphExportError(
    'CG-5007',
    'ClassGraph could not find its bundled PDF font. Reinstall ClassGraph or use DOCX export.',
  )
}

const isIgnorable = (character: string) => /\s/u.test(character)

function winAnsiMissing(font: PdfFontAdapter, text: string): string[] {
  try {
    font.encodeText(text)
    return []
  } catch {
    return [...new Set([...text])].filter((character) => {
      if (isIgnorable(character)) return false
      try {
        font.encodeText(character)
        return false
      } catch {
        return true
      }
    })
  }
}

export function unsupportedCharacterError(characters: string[]): ClassGraphExportError {
  const listed = characters.slice(0, 12).join(' ')
  return new ClassGraphExportError(
    'CG-5004',
    `This PDF contains characters the bundled PDF fonts cannot draw (${listed}${characters.length > 12 ? ' …' : ''}). Use DOCX export for this text, or change it. ClassGraph does not replace or drop characters silently.`,
  )
}

export function assertRenderable(font: ReportFont, text: string): void {
  const missing = font.missingCharacters(text)
  if (missing.length > 0) throw unsupportedCharacterError(missing)
}

/** Chooses and embeds fonts able to draw every string in `texts`, or throws CG-5004. */
export async function embedReportFonts(
  document: PdfDocumentAdapter,
  texts: Iterable<string>,
): Promise<ReportFonts> {
  const corpus = [...texts].join('\n')
  const helvetica = await document.embedFont(pdfStandardFonts.Helvetica)

  if (winAnsiMissing(helvetica, corpus).length === 0) {
    const helveticaBold = await document.embedFont(pdfStandardFonts.HelveticaBold)
    const standard = (pdf: PdfFontAdapter): ReportFont => ({
      pdf,
      syntheticBold: false,
      missingCharacters: (text) => winAnsiMissing(pdf, text),
    })
    return { regular: standard(helvetica), bold: standard(helveticaBold), unicode: false }
  }

  const { bytes, glyphs } = loadUnicodeFont()
  const missingCharacters = (text: string) =>
    [...new Set([...text])].filter(
      (character) =>
        !isIgnorable(character) && !glyphs.hasGlyphForCodePoint(character.codePointAt(0) ?? 0),
    )
  const missing = missingCharacters(corpus)
  if (missing.length > 0) throw unsupportedCharacterError(missing)

  const pdf = await document.embedFont(bytes, { subset: true })
  return {
    regular: { pdf, syntheticBold: false, missingCharacters },
    bold: { pdf, syntheticBold: true, missingCharacters },
    unicode: true,
  }
}

export function drawReportText(
  page: PdfPageAdapter,
  text: string,
  font: ReportFont,
  options: Omit<Parameters<PdfPageAdapter['drawText']>[1], 'font'>,
): void {
  assertRenderable(font, text)
  const drawOptions = { ...options, font: font.pdf }
  if (font.syntheticBold) drawSyntheticBoldText(page, text, drawOptions)
  else page.drawText(text, drawOptions)
}
