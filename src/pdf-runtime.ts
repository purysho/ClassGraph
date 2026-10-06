import fontkit from '@pdf-lib/fontkit'
import * as pdfLib from 'pdf-lib'

export type PdfColor = unknown

export interface PdfFontAdapter {
  encodeText(text: string): unknown
  widthOfTextAtSize(text: string, size: number): number
}

export interface PdfPageAdapter {
  drawText(
    text: string,
    options: {
      x: number
      y: number
      size: number
      font: PdfFontAdapter
      color?: PdfColor
      maxWidth?: number
      lineHeight?: number
    },
  ): void
  drawRectangle(options: {
    x: number
    y: number
    width: number
    height: number
    borderWidth?: number
    borderColor?: PdfColor
    color?: PdfColor
  }): void
  getWidth(): number
  getHeight(): number
  pushOperators(...operators: unknown[]): void
}

export interface PdfDocumentAdapter {
  addPage(size?: [number, number]): PdfPageAdapter
  embedFont(font: string | Uint8Array, options?: { subset?: boolean }): Promise<PdfFontAdapter>
  registerFontkit(kit: unknown): void
  save(): Promise<Uint8Array>
  getPages(): PdfPageAdapter[]
  getPage(index: number): PdfPageAdapter
  getPageCount(): number
}

interface PdfDocumentStaticAdapter {
  create(): Promise<PdfDocumentAdapter>
  load(bytes: Uint8Array): Promise<PdfDocumentAdapter>
}

interface PdfLibAdapter {
  PDFDocument: PdfDocumentStaticAdapter
  StandardFonts: {
    Helvetica: string
    HelveticaBold: string
  }
  rgb(red: number, green: number, blue: number): PdfColor
  pushGraphicsState(): unknown
  popGraphicsState(): unknown
  setTextRenderingMode(mode: number): unknown
  setLineWidth(width: number): unknown
  setStrokingColor(color: PdfColor): unknown
  TextRenderingMode: { FillAndOutline: number }
}

const runtime = pdfLib as unknown as PdfLibAdapter

export const pdfStandardFonts = runtime.StandardFonts
export const pdfRgb = (red: number, green: number, blue: number): PdfColor =>
  runtime.rgb(red, green, blue)

export async function createPdfDocument(): Promise<PdfDocumentAdapter> {
  const document = await runtime.PDFDocument.create()
  document.registerFontkit(fontkit)
  return document
}

/**
 * Draws text with a fill-and-outline render mode so a single regular-weight font can stand in
 * for bold (used for the bundled CJK font, which ships one weight only).
 */
export function drawSyntheticBoldText(
  page: PdfPageAdapter,
  text: string,
  options: Parameters<PdfPageAdapter['drawText']>[1],
): void {
  page.pushOperators(
    runtime.pushGraphicsState(),
    runtime.setTextRenderingMode(runtime.TextRenderingMode.FillAndOutline),
    runtime.setLineWidth(options.size * 0.035),
    runtime.setStrokingColor(options.color ?? runtime.rgb(0, 0, 0)),
  )
  page.drawText(text, options)
  page.pushOperators(runtime.popGraphicsState())
}

export function loadPdfDocument(bytes: Uint8Array): Promise<PdfDocumentAdapter> {
  return runtime.PDFDocument.load(bytes)
}
