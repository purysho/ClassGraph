import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'
import { ASSOCIATION_CAVEAT } from '../src/analysis-compare.js'
import { dispatchClassGraphApi } from '../src/api-dispatch.js'
import { buildAnalysisExport } from '../src/export-json.js'
import { buildEduBoardHandback } from '../src/eduboard-handback.js'
import {
  addMetricDefinition,
  removeMetricDefinition,
  setStudentMetricValue,
} from '../src/metrics.js'
import type { ClassGraphProject } from '../src/model.js'
import { loadPdfDocument } from '../src/pdf-runtime.js'
import { applyProjectMutation } from '../src/project-mutations.js'
import { buildHumanReport } from '../src/report-content.js'
import {
  addReportComparison,
  buildReportComparisonResults,
  removeReportComparison,
} from '../src/report-comparisons.js'
import { generateDocxReport } from '../src/report-docx.js'
import { generatePdfReport } from '../src/report-pdf.js'
import { classGraphProjectSchema, reportComparisonId } from '../src/schema.js'
import { addStudent, createEmptyProject } from '../src/workspace.js'

const t0 = '2026-10-06T10:00:00.000Z'
const t1 = '2026-10-06T11:00:00.000Z'

function baseProject(): ClassGraphProject {
  let project = createEmptyProject({
    projectId: 'report-compare',
    title: 'Report Compare',
    now: t0,
  })
  project = addStudent(project, { id: 's1', tags: ['choir', 'band'] }, t0)
  project = addStudent(project, { id: 's2', tags: ['choir'] }, t0)
  project = addStudent(project, { id: 's3' }, t0)
  project = addStudent(project, { id: 's4' }, t0)
  project = addMetricDefinition(
    project,
    { key: 'support', label: 'Support', kind: 'category', categories: ['more', 'less'] },
    t0,
  )
  project = addMetricDefinition(project, { key: 'club', label: 'Club', kind: 'boolean' }, t0)
  project = addMetricDefinition(project, { key: 'score', label: 'Score', kind: 'number' }, t0)
  project = addMetricDefinition(project, { key: 'minutes', label: 'Minutes', kind: 'number' }, t0)
  project = addMetricDefinition(project, { key: 'note', label: 'Note', kind: 'text' }, t0)
  const values: Array<[string, string, string | boolean | number | null]> = [
    ['s1', 'support', 'more'],
    ['s2', 'support', 'less'],
    ['s3', 'support', null],
    ['s4', 'support', 'more'],
    ['s1', 'club', true],
    ['s2', 'club', false],
    ['s4', 'club', true],
    ['s1', 'score', 40],
    ['s2', 'score', 60],
    ['s3', 'score', 80],
    ['s1', 'minutes', 10],
    ['s2', 'minutes', 20],
    ['s3', 'minutes', 30],
    ['s4', 'minutes', 30],
  ]
  for (const [studentId, key, value] of values) {
    project = setStudentMetricValue(project, studentId, key, value, t0)
  }
  return project
}

function selectedProject(): ClassGraphProject {
  let project = baseProject()
  project = addReportComparison(
    project,
    { kind: 'crosstab', rowMetricKey: 'support', columnMetricKey: 'club' },
    t1,
  )
  project = addReportComparison(
    project,
    { kind: 'association', xMetricKey: 'score', yMetricKey: 'minutes' },
    t1,
  )
  project = addReportComparison(
    project,
    { kind: 'group-summary', metricKey: 'score', basis: 'tag' },
    t1,
  )
  return project
}

describe('report comparison selections', () => {
  it('persists teacher selections with teacher-entered provenance', () => {
    const project = selectedProject()

    expect(project.reporting?.comparisons).toHaveLength(3)
    expect(project.provenance['/reporting/comparisons']).toEqual({
      kind: 'teacher-entered',
      source: 'report-comparison-selection',
    })
    expect(project.updatedAt).toBe(t1)
    expect(classGraphProjectSchema.parse(project).reporting).toEqual(project.reporting)
  })

  it('rejects duplicates and removes by stable id', () => {
    const project = selectedProject()
    expect(() =>
      addReportComparison(
        project,
        { kind: 'crosstab', rowMetricKey: 'support', columnMetricKey: 'club' },
        t1,
      ),
    ).toThrow('CG-3009')

    const id = reportComparisonId({ kind: 'group-summary', metricKey: 'score', basis: 'tag' })
    const removed = removeReportComparison(project, id, t1)
    expect(removed.reporting?.comparisons).toHaveLength(2)
    expect(() => removeReportComparison(removed, id, t1)).toThrow('CG-3011')
  })

  it('clears the reporting block and provenance when the last selection is removed', () => {
    let project = addReportComparison(
      baseProject(),
      { kind: 'association', xMetricKey: 'score', yMetricKey: 'minutes' },
      t1,
    )
    project = removeReportComparison(
      project,
      reportComparisonId({ kind: 'association', xMetricKey: 'score', yMetricKey: 'minutes' }),
      t1,
    )
    expect(project.reporting).toBeUndefined()
    expect(project.provenance['/reporting/comparisons']).toBeUndefined()
  })

  it('rejects ineligible or unknown metrics at the schema boundary', () => {
    const project = baseProject()
    const invalid = [
      { kind: 'crosstab', rowMetricKey: 'score', columnMetricKey: 'club' },
      { kind: 'association', xMetricKey: 'support', yMetricKey: 'score' },
      { kind: 'association', xMetricKey: 'score', yMetricKey: 'score' },
      { kind: 'group-summary', metricKey: 'note', basis: 'tag' },
      { kind: 'group-summary', metricKey: 'missing-metric', basis: 'planning-group' },
    ] as const
    for (const comparison of invalid) {
      expect(() => addReportComparison(project, comparison, t1)).toThrow()
    }
  })

  it('drops selections that reference a removed metric', () => {
    let project = selectedProject()
    project = removeMetricDefinition(project, 'score', t1)
    expect(project.reporting?.comparisons).toEqual([
      { kind: 'crosstab', rowMetricKey: 'support', columnMetricKey: 'club' },
    ])

    project = removeMetricDefinition(project, 'club', t1)
    expect(project.reporting).toBeUndefined()
    expect(project.provenance['/reporting/comparisons']).toBeUndefined()
  })

  it('is reachable through validated project mutations and the API', async () => {
    const viaMutation = applyProjectMutation(
      baseProject(),
      {
        type: 'add-report-comparison',
        comparison: { kind: 'group-summary', metricKey: 'support', basis: 'tag' },
      },
      t1,
    )
    expect(viaMutation.reporting?.comparisons).toHaveLength(1)

    const response = await dispatchClassGraphApi({
      method: 'POST',
      path: '/api/project/mutate',
      body: JSON.stringify({
        project: baseProject(),
        command: {
          type: 'add-report-comparison',
          comparison: { kind: 'crosstab', rowMetricKey: 'support', columnMetricKey: 'club' },
        },
      }),
    })
    expect(response.status).toBe(200)
    const body = JSON.parse(response.body as string) as { project: ClassGraphProject }
    expect(body.project.reporting?.comparisons).toHaveLength(1)
  })
})

describe('comparisons in reports and exports', () => {
  it('recomputes results from current data in selection order', () => {
    let project = selectedProject()
    project = setStudentMetricValue(project, 's4', 'score', 100, t1)
    const results = buildReportComparisonResults(project)

    expect(results.map((result) => result.selection.kind)).toEqual([
      'crosstab',
      'association',
      'group-summary',
    ])
    const association = results[1]
    expect(association && 'association' in association).toBe(true)
    if (!association || !('association' in association)) return
    expect(association.association.association.pairCount).toBe(4)
    expect(association.association.omittedCount).toBe(0)
  })

  it('adds a Selected comparisons section with caveats to the human report', () => {
    const report = buildHumanReport(selectedProject())
    const titles = report.sections.map((section) => section.title)
    expect(titles.indexOf('Selected comparisons')).toBe(titles.indexOf('Metric summaries') + 1)

    const section = report.sections.find((item) => item.title === 'Selected comparisons')
    expect(section?.paragraphs).toContain(ASSOCIATION_CAVEAT)
    expect(section?.tables).toHaveLength(3)

    const crossTab = section?.tables[0]
    expect(crossTab?.headers).toEqual(['Support', 'Yes', 'No', 'Not recorded', 'Total'])
    expect(crossTab?.rows).toEqual([
      ['more', '2', '0', '0', '2'],
      ['less', '0', '1', '0', '1'],
      ['Missing', '0', '0', '1', '1'],
      ['Total', '2', '1', '1', '4'],
    ])
    expect(section?.tables[1]?.rows[0]?.[0]).toBe('1.00')
    expect(section?.tables[2]?.title).toContain('counted in each')
  })

  it('omits the section entirely when nothing is selected', () => {
    const report = buildHumanReport(baseProject())
    expect(report.sections.some((section) => section.title === 'Selected comparisons')).toBe(false)
  })

  it('reports a withheld coefficient in plain language', () => {
    let project = baseProject()
    project = setStudentMetricValue(project, 's2', 'score', null, t0)
    project = setStudentMetricValue(project, 's3', 'score', null, t0)
    project = addReportComparison(
      project,
      { kind: 'association', xMetricKey: 'score', yMetricKey: 'minutes' },
      t1,
    )
    const section = buildHumanReport(project).sections.find(
      (item) => item.title === 'Selected comparisons',
    )
    expect(section?.tables[0]?.rows[0]?.[0]).toBe(
      'Not shown: fewer than 3 students with both values',
    )
  })

  it('includes results in analysis export v1.1 but not in the EduBoard hand-back', () => {
    const project = selectedProject()
    const exported = buildAnalysisExport(project)
    expect(exported.version).toBe('1.1')
    expect(exported.comparisons).toHaveLength(3)
    expect(exported.comparisons[0]?.id).toBe(
      reportComparisonId({ kind: 'crosstab', rowMetricKey: 'support', columnMetricKey: 'club' }),
    )
    expect(buildAnalysisExport(baseProject()).comparisons).toEqual([])

    const handback = buildEduBoardHandback(project)
    expect(JSON.stringify(handback.derivedAnalysis)).not.toContain('crossTab')
  })

  it('renders the section into DOCX and PDF reports', async () => {
    const project = selectedProject()
    const docx = await generateDocxReport(project)
    const zip = await JSZip.loadAsync(docx)
    const xml = (await zip.file('word/document.xml')?.async('string')) ?? ''
    expect(xml).toContain('Selected comparisons')
    expect(xml).toContain('Association between Score and Minutes')
    expect(xml).toContain('Association is not causation')

    const pdf = await generatePdfReport(project)
    const withoutSelections = await generatePdfReport(baseProject())
    expect((await loadPdfDocument(pdf)).getPageCount()).toBeGreaterThanOrEqual(
      (await loadPdfDocument(withoutSelections)).getPageCount(),
    )
    expect(pdf.byteLength).toBeGreaterThan(withoutSelections.byteLength)
  })
})
