import { createRequire } from 'node:module'

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
}

export interface PdfDocumentAdapter {
  addPage(size?: [number, number]): PdfPageAdapter
  embedFont(fontName: string): Promise<PdfFontAdapter>
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
}

const require = createRequire(import.meta.url)

function loadRuntime(): PdfLibAdapter {
  const raw: unknown = require('pdf-lib')
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('CG-9001 PDF runtime did not load as an object')
  }
  return raw as PdfLibAdapter
}

const runtime = loadRuntime()

export const pdfStandardFonts = runtime.StandardFonts
export const pdfRgb = (red: number, green: number, blue: number): PdfColor =>
  runtime.rgb(red, green, blue)

export function createPdfDocument(): Promise<PdfDocumentAdapter> {
  return runtime.PDFDocument.create()
}

export function loadPdfDocument(bytes: Uint8Array): Promise<PdfDocumentAdapter> {
  return runtime.PDFDocument.load(bytes)
}
