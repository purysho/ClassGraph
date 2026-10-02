import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  PageOrientation,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  convertMillimetersToTwip,
} from 'docx'
import type { ClassGraphProject } from './model.js'
import { buildHumanReport, type HumanReportTable } from './report-content.js'

function paragraph(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, size: 20 })],
    spacing: { after: 100 },
  })
}

function heading(text: string): Paragraph {
  return new Paragraph({
    text,
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 220, after: 100 },
  })
}

function tableCell(text: string, bold = false): TableCell {
  return new TableCell({
    children: [
      new Paragraph({
        children: [new TextRun({ text, bold, size: 18 })],
      }),
    ],
  })
}

function renderTable(table: HumanReportTable): Array<Paragraph | Table> {
  const rows = [
    new TableRow({
      tableHeader: true,
      children: table.headers.map((header) => tableCell(header, true)),
    }),
    ...table.rows.map(
      (row) =>
        new TableRow({
          children: row.map((value) => tableCell(value)),
        }),
    ),
  ]

  return [
    ...(table.title
      ? [
          new Paragraph({
            children: [new TextRun({ text: table.title, bold: true, size: 20 })],
            spacing: { before: 100, after: 80 },
          }),
        ]
      : []),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows,
    }),
    new Paragraph({ text: '', spacing: { after: 120 } }),
  ]
}

export async function generateDocxReport(project: ClassGraphProject): Promise<Uint8Array> {
  const report = buildHumanReport(project)
  const children: Array<Paragraph | Table> = [
    new Paragraph({
      text: report.title,
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
    }),
    new Paragraph({
      children: [new TextRun({ text: report.subtitle, italics: true, size: 22 })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
    }),
  ]

  for (const section of report.sections) {
    children.push(heading(section.title))
    children.push(...section.paragraphs.map(paragraph))
    for (const table of section.tables) children.push(...renderTable(table))
  }

  const document = new Document({
    creator: 'ClassGraph',
    title: report.title,
    description: 'Local ClassGraph descriptive classroom report',
    sections: [
      {
        properties: {
          page: {
            size: {
              width: convertMillimetersToTwip(210),
              height: convertMillimetersToTwip(297),
              orientation: PageOrientation.PORTRAIT,
            },
            margin: {
              top: convertMillimetersToTwip(15),
              right: convertMillimetersToTwip(15),
              bottom: convertMillimetersToTwip(15),
              left: convertMillimetersToTwip(15),
            },
          },
        },
        children,
      },
    ],
  })

  return new Uint8Array(await Packer.toBuffer(document))
}
