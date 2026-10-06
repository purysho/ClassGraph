import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'
import { dispatchClassGraphApi } from '../src/api-dispatch.js'
import { addMetricDefinition, setStudentMetricValue } from '../src/metrics.js'
import type { ClassGraphProject } from '../src/model.js'
import {
  applyTableImport,
  inferMetricKind,
  planTableImport,
  suggestTableImport,
  type TableImportRequest,
} from '../src/table-import.js'
import { decodeCsvBytes, parseCsv, readTableFile, type TableCell } from '../src/table-read.js'
import { addStudent, createEmptyProject } from '../src/workspace.js'

const now = '2026-10-06T10:00:00.000Z'

async function workbook(): Promise<Uint8Array> {
  const zip = new JSZip()
  zip.file(
    'xl/workbook.xml',
    '<workbook xmlns:r="r"><sheets><sheet name="五年级3班" sheetId="1" r:id="rId1"/><sheet name="Empty" sheetId="2" r:id="rId2"/></sheets></workbook>',
  )
  zip.file(
    'xl/_rels/workbook.xml.rels',
    '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Target="/xl/worksheets/sheet2.xml"/></Relationships>',
  )
  zip.file(
    'xl/sharedStrings.xml',
    '<sst><si><t>学号</t></si><si><t>姓名</t></si><si><t>成绩</t></si><si><r><t>张</t></r><r><t xml:space="preserve">喆</t></r></si><si><t>Tom &amp; Co</t></si></sst>',
  )
  zip.file(
    'xl/styles.xml',
    '<styleSheet><numFmts><numFmt numFmtId="164" formatCode="yyyy/mm/dd"/></numFmts><cellXfs count="3"><xf numFmtId="0"/><xf numFmtId="14"/><xf numFmtId="164"/></cellXfs></styleSheet>',
  )
  zip.file(
    'xl/worksheets/sheet1.xml',
    `<worksheet><sheetData>
      <row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c><c r="D1" t="inlineStr"><is><t>Joined</t></is></c><c r="E1" t="inlineStr"><is><t>Club</t></is></c></row>
      <row r="2"><c r="A2"><v>101</v></c><c r="B2" t="s"><v>3</v></c><c r="C2"><v>88.5</v></c><c r="D2" s="1"><v>45200</v></c><c r="E2" t="b"><v>1</v></c></row>
      <row r="4"><c r="A4"><v>102</v></c><c r="B4" t="s"><v>4</v></c><c r="D4" s="2"><v>45201</v></c><c r="E4" t="b"><v>0</v></c></row>
    </sheetData></worksheet>`,
  )
  zip.file('xl/worksheets/sheet2.xml', '<worksheet><sheetData/></worksheet>')
  return zip.generateAsync({ type: 'uint8array' })
}

function existingClass(): ClassGraphProject {
  let project = createEmptyProject({ projectId: 'merge', title: 'Merge', now })
  project = addStudent(project, { id: '101', displayName: 'Old name' }, now)
  project = addStudent(project, { id: '103', displayName: 'Not in file' }, now)
  project = addMetricDefinition(project, { key: 'score', label: 'Score', kind: 'number' }, now)
  project = addMetricDefinition(
    project,
    { key: 'support', label: 'Support', kind: 'category', categories: ['more', 'less'] },
    now,
  )
  project = setStudentMetricValue(project, '101', 'score', 70, now)
  project = setStudentMetricValue(project, '101', 'support', 'more', now)
  return project
}

function request(rows: TableCell[][], existing?: ClassGraphProject): TableImportRequest {
  const suggestion = suggestTableImport(rows, existing)
  return {
    sourceName: 'roster.csv',
    rows,
    headerRow: suggestion.headerRow,
    columns: suggestion.columns,
  }
}

describe('reading spreadsheet files', () => {
  it('parses quoted CSV fields, doubled quotes, CRLF and blank cells', () => {
    expect(parseCsv('id,name,note\r\n1,"Lee, Ann","said ""hi"""\r\n2,,\r\n')).toEqual([
      ['id', 'name', 'note'],
      ['1', 'Lee, Ann', 'said "hi"'],
      ['2', null, null],
    ])
  })

  it('detects semicolon and tab delimiters', () => {
    expect(parseCsv('a;b\n1;2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ])
    expect(parseCsv('a\tb\n1\t2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ])
  })

  it('decodes UTF-8 with a BOM and falls back to GB18030 for Chinese Excel CSVs', () => {
    expect(decodeCsvBytes(new TextEncoder().encode('﻿学号,姓名')).text).toBe('学号,姓名')
    // "学号,张三" encoded as GBK
    const gbk = new Uint8Array([0xd1, 0xa7, 0xba, 0xc5, 0x2c, 0xd5, 0xc5, 0xc8, 0xfd])
    expect(decodeCsvBytes(gbk)).toEqual({ text: '学号,张三', encoding: 'gb18030' })
  })

  it('reads .xlsx shared, inline and rich strings, numbers, booleans, dates and gaps', async () => {
    const table = await readTableFile('class.xlsx', await workbook())
    expect(table.format).toBe('xlsx')
    expect(table.sheets.map((sheet) => sheet.name)).toEqual(['五年级3班', 'Empty'])
    expect(table.sheets[0]?.rows).toEqual([
      ['学号', '姓名', '成绩', 'Joined', 'Club'],
      [101, '张喆', 88.5, '2023-10-01', true],
      [null, null, null, null, null],
      [102, 'Tom & Co', null, '2023-10-02', false],
    ])
    expect(table.sheets[1]?.rows).toEqual([])
  })

  it('refuses old .xls workbooks with a clear next step', async () => {
    await expect(readTableFile('old.xls', new Uint8Array([1, 2]))).rejects.toThrow(
      /CG-1101.*\.xlsx/,
    )
  })
})

describe('suggesting a column mapping', () => {
  it('recognises Chinese and English headers and infers metric kinds', () => {
    const suggestion = suggestTableImport([
      ['学号', '姓名', '标签', '口语成绩', '语言支持', '合唱团', 'Comment', ''],
      ['1', '张三', '合唱、篮球', '85', '需要', '是', 'Great work', null],
      ['2', '李四', null, '90', '不需要', '否', 'Asks questions', null],
      ['3', '王五', null, null, '需要', '否', 'Quiet today', null],
    ])
    expect(suggestion.headerRow).toBe(true)
    expect(
      suggestion.columns.map((column) => (column.role === 'metric' ? column.kind : column.role)),
    ).toEqual([
      'student-id',
      'display-name',
      'tags',
      'number',
      'category',
      'boolean',
      'text',
      'ignore',
    ])
    const category = suggestion.columns[4]
    expect(category?.role === 'metric' && category.categories).toEqual(['需要', '不需要'])
  })

  it('maps headers to existing metrics when updating a class', () => {
    const suggestion = suggestTableImport(
      [
        ['ID', 'Score'],
        ['101', '75'],
      ],
      existingClass(),
    )
    expect(suggestion.columns[1]).toMatchObject({
      role: 'metric',
      metricKey: 'score',
      existing: true,
    })
  })

  it('treats full-width digits and thousands separators as numbers', () => {
    expect(inferMetricKind(['８５', '1,200', 3]).kind).toBe('number')
  })
})

describe('planning and applying an import', () => {
  const rows: TableCell[][] = [
    ['姓名', '成绩', '标签'],
    ['张三', '85', '合唱，篮球'],
    ['李四', null, null],
    [null, null, null],
    ['王五', '92', '合唱'],
  ]

  it('creates a new class with generated IDs, imported provenance and blanks as missing', () => {
    const importRequest = request(rows)
    const plan = planTableImport(importRequest)
    expect(plan).toMatchObject({
      mode: 'new-project',
      studentCount: 3,
      studentsAdded: 3,
      generatedIds: true,
      valueCount: 2,
      missingCount: 1,
      errors: [],
    })

    const project = applyTableImport(importRequest, {
      mode: 'new-project',
      projectId: 'imported',
      title: 'Imported',
      now,
    })
    expect(project.students.map((student) => [student.id, student.displayName])).toEqual([
      ['s001', '张三'],
      ['s002', '李四'],
      ['s003', '王五'],
    ])
    const key = project.metricDefinitions[0]?.key ?? ''
    expect(project.students[1]?.metrics[key]).toBeNull()
    expect(project.students[0]?.tags).toEqual(['合唱', '篮球'])
    expect(project.provenance[`/students/0/metrics/${key}`]).toEqual({
      kind: 'imported',
      source: 'spreadsheet:roster.csv',
    })
  })

  it('reports every bad cell and duplicate ID by row, and refuses to apply', () => {
    const bad = request([
      ['ID', 'Score'],
      ['1', '85'],
      ['1', '90'],
      ['2', '85分'],
      [null, '70'],
    ])
    bad.columns[1] = { role: 'metric', metricKey: 'score', label: 'Score', kind: 'number' }
    const plan = planTableImport(bad)
    expect(plan.errors).toEqual([
      { row: 3, message: 'Student ID "1" also appears on row 2.' },
      { row: 4, column: 'Score', message: '"85分" is not a number' },
      { row: 5, column: 'ID', message: 'This row has no student ID.' },
    ])
    expect(() =>
      applyTableImport(bad, { mode: 'new-project', projectId: 'x', title: 'X', now }),
    ).toThrow('CG-1102')
  })

  it('updates an existing class without erasing recorded values from blank cells', () => {
    const existing = existingClass()
    const merge = request(
      [
        ['ID', 'Name', 'Score', 'Support'],
        ['101', 'New name', null, 'less'],
        ['104', 'Newcomer', '88', null],
      ],
      existing,
    )
    const plan = planTableImport(merge, existing)
    expect(plan).toMatchObject({
      mode: 'merge',
      studentsAdded: 1,
      studentsUpdated: 1,
      studentsNotInFile: 1,
      blanksKeptExisting: 1,
      newMetrics: [],
      errors: [],
    })
    expect(plan.changes).toEqual([
      { studentId: '101', field: 'Name', from: 'Old name', to: 'New name' },
      { studentId: '101', field: 'Support', from: 'more', to: 'less' },
    ])

    const project = applyTableImport(merge, { mode: 'merge', project: existing, now })
    const student101 = project.students.find((student) => student.id === '101')
    expect(student101?.metrics).toEqual({ score: 70, support: 'less' })
    expect(project.students.find((student) => student.id === '104')?.metrics).toEqual({
      score: 88,
      support: null,
    })
    expect(project.students.find((student) => student.id === '103')?.displayName).toBe(
      'Not in file',
    )
  })

  it('needs an ID column to update a class and rejects values outside existing categories', () => {
    const existing = existingClass()
    const noId = request(
      [
        ['Name', 'Score'],
        ['A', '1'],
      ],
      existing,
    )
    expect(planTableImport(noId, existing).errors[0]?.message).toContain('student ID column')

    const badCategory = request(
      [
        ['ID', 'Support'],
        ['101', 'some'],
      ],
      existing,
    )
    expect(planTableImport(badCategory, existing).errors[0]).toMatchObject({
      row: 2,
      column: 'Support',
    })
  })
})

describe('spreadsheet import API', () => {
  it('reads a file, previews and applies through the shared dispatcher', async () => {
    const csv = Buffer.from('学号,姓名,成绩\n1,张三,85\n2,李四,\n').toString('base64')
    const read = await dispatchClassGraphApi({
      method: 'POST',
      path: '/api/import/table/read',
      body: JSON.stringify({ fileName: '名单.csv', dataBase64: csv }),
    })
    expect(read.status).toBe(200)
    const { table, suggestions } = JSON.parse(read.body as string) as {
      table: { sheets: Array<{ rows: TableCell[][] }> }
      suggestions: Array<{ headerRow: boolean; columns: TableImportRequest['columns'] }>
    }
    const importRequest = {
      sourceName: '名单.csv',
      rows: table.sheets[0]?.rows ?? [],
      headerRow: suggestions[0]?.headerRow ?? true,
      columns: suggestions[0]?.columns ?? [],
    }

    const preview = await dispatchClassGraphApi({
      method: 'POST',
      path: '/api/import/table/preview',
      body: JSON.stringify({ request: importRequest }),
    })
    expect((JSON.parse(preview.body as string) as { plan: unknown }).plan).toMatchObject({
      studentCount: 2,
      missingCount: 1,
    })

    const applied = await dispatchClassGraphApi({
      method: 'POST',
      path: '/api/import/table/apply',
      body: JSON.stringify({ request: importRequest, projectId: 'csv', title: '名单' }),
    })
    expect(applied.status).toBe(200)
    const project = (JSON.parse(applied.body as string) as { project: ClassGraphProject }).project
    expect(project.students.map((student) => student.id)).toEqual(['1', '2'])
  })

  it('rejects malformed import requests with CG-1001', async () => {
    const response = await dispatchClassGraphApi({
      method: 'POST',
      path: '/api/import/table/preview',
      body: JSON.stringify({
        request: { sourceName: 'x', rows: 'nope', headerRow: true, columns: [] },
      }),
    })
    expect(response.status).toBe(400)
    expect((JSON.parse(response.body as string) as { error: { code: string } }).error.code).toBe(
      'CG-1001',
    )
  })
})
