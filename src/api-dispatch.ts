import { buildCrossTab, buildGroupSummary, type GroupingBasis } from './analysis-compare.js'
import { buildProjectAnalysis, buildScatterView } from './analysis-view.js'
import {
  applyTableImport,
  parseTableImportRequest,
  planTableImport,
  suggestTableImport,
} from './table-import.js'
import { readTableFile } from './table-read.js'
import { acceptPlanningRuleSuggestions, acceptSyntheticSpecDraft } from './assistance-acceptance.js'
import type { AssistanceExecutionMode, AssistanceTask } from './assistance-contract.js'
import type { AssistanceProvider } from './assistance-provider.js'
import {
  assistanceServiceStatus,
  buildAssistanceRequest,
  runAssistance,
} from './assistance-service.js'
import { serializeEduBoardHandback } from './eduboard-handback.js'
import { ClassGraphExportError } from './export-errors.js'
import {
  safeExportStem,
  serializeAnalysisExport,
  serializeSeatingPlanExport,
} from './export-json.js'
import { generateGroupingCandidates } from './grouping.js'
import { ClassGraphImportError, parseProjectJson, serializeProjectJson } from './json.js'
import { generateSeatingCandidates } from './planning.js'
import { buildRepeatNeighbourHistory } from './planning-history.js'
import { comparePlanningScenarios } from './planning-scenarios.js'
import type { FileProjectStore } from './project-store.js'
import { applyProjectMutation, parseProjectMutationRequest } from './project-mutations.js'
import { buildRelationshipGraph } from './relationship-graph.js'
import { generateDocxReport } from './report-docx.js'
import { generatePdfReport, generateSeatingPlanPdf } from './report-pdf.js'
import { classGraphProjectSchema } from './schema.js'
import { parseStructuredSyntheticRequest } from './synthetic-request.js'
import { generateSyntheticProject } from './synthetic.js'
import { createEmptyProject } from './workspace.js'

export interface ClassGraphApiOptions {
  assistanceProvider?: AssistanceProvider
  projectStore?: FileProjectStore
  desktop?: boolean
  desktopQuit?: () => void
}

export interface ClassGraphApiRequest {
  method: 'GET' | 'POST'
  path: string
  body?: string
}

export interface ClassGraphApiResponse {
  status: number
  contentType: string
  body: string | Uint8Array
  filename?: string
}

interface ProjectSetupRequest {
  projectId: string
  title: string
  classInfo?: {
    subject?: string
    gradeOrLevel?: string
    term?: string
    teacherLabel?: string
  }
}

function jsonResponse(status: number, value: unknown): ClassGraphApiResponse {
  return {
    status,
    contentType: 'application/json; charset=utf-8',
    body: JSON.stringify(value),
  }
}

function downloadResponse(
  body: string | Uint8Array,
  contentType: string,
  filename: string,
): ClassGraphApiResponse {
  return { status: 200, body, contentType, filename }
}

function parseJsonBody(body: string | undefined): unknown {
  if (!body) return {}
  try {
    return JSON.parse(body) as unknown
  } catch {
    throw new Error('CG-1001 request body is not valid JSON')
  }
}

function expectRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('CG-1001 request body must be a JSON object')
  }
  return value as Record<string, unknown>
}

function expectString(record: Record<string, unknown>, key: string): string {
  const value = record[key]
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`CG-1001 ${key} must be a non-empty string`)
  }
  return value.trim()
}

function optionalString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key]
  if (value === undefined || value === '') return undefined
  if (typeof value !== 'string') throw new Error(`CG-1001 ${key} must be a string`)
  return value
}

function optionalPositiveInteger(record: Record<string, unknown>, key: string): number | undefined {
  const value = record[key]
  if (value === undefined) return undefined
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
    throw new Error(`CG-1001 ${key} must be a positive integer`)
  }
  return value
}

function requiredPositiveInteger(record: Record<string, unknown>, key: string): number {
  const value = optionalPositiveInteger(record, key)
  if (value === undefined) throw new Error(`CG-1001 ${key} is required`)
  return value
}

function optionalBoolean(record: Record<string, unknown>, key: string): boolean | undefined {
  const value = record[key]
  if (value === undefined) return undefined
  if (typeof value !== 'boolean') throw new Error(`CG-6001 ${key} must be a boolean`)
  return value
}

function requiredIndexArray(record: Record<string, unknown>, key: string): number[] {
  const value = record[key]
  if (!Array.isArray(value)) {
    throw new Error(`CG-6001 ${key} must be an array of non-negative integer indexes`)
  }

  return value.map((item) => {
    if (typeof item !== 'number' || !Number.isInteger(item) || item < 0) {
      throw new Error(`CG-6001 ${key} must be an array of non-negative integer indexes`)
    }
    return item
  })
}

function expectGroupingBasis(record: Record<string, unknown>): GroupingBasis {
  const value = record.basis
  if (value === 'tag' || value === 'planning-group') return value
  throw new Error('CG-1001 basis must be tag or planning-group')
}

function parseAssistanceTask(record: Record<string, unknown>): AssistanceTask {
  const value = record.task
  if (
    value === 'synthetic-spec-draft' ||
    value === 'analysis-explanation' ||
    value === 'report-wording-draft' ||
    value === 'planning-rule-suggestions'
  ) {
    return value
  }
  throw new Error('CG-6001 task must be a supported assistance task')
}

function parseAssistanceMode(record: Record<string, unknown>): AssistanceExecutionMode {
  const value = record.mode
  if (value === 'offline' || value === 'network') return value
  throw new Error('CG-6001 mode must be offline or network')
}

function parseProjectSetup(value: unknown): ProjectSetupRequest {
  const record = expectRecord(value)
  const classInfoValue = record.classInfo
  let classInfo: ProjectSetupRequest['classInfo']

  if (classInfoValue !== undefined) {
    const info = expectRecord(classInfoValue)
    classInfo = {
      subject: optionalString(info, 'subject'),
      gradeOrLevel: optionalString(info, 'gradeOrLevel'),
      term: optionalString(info, 'term'),
      teacherLabel: optionalString(info, 'teacherLabel'),
    }
  }

  return {
    projectId: expectString(record, 'projectId'),
    title: expectString(record, 'title'),
    classInfo,
  }
}

function parseProjectFromRequest(record: Record<string, unknown>) {
  const result = classGraphProjectSchema.safeParse(record.project)
  if (!result.success) {
    const issue = result.error.issues[0]
    throw new Error(`CG-1001 invalid project in request: ${issue?.message ?? 'validation failed'}`)
  }
  return result.data
}

function apiError(error: unknown): ClassGraphApiResponse {
  const message = error instanceof Error ? error.message : 'Unexpected ClassGraph error.'
  const code =
    error instanceof ClassGraphImportError || error instanceof ClassGraphExportError
      ? error.code
      : (/^CG-\d{4}/.exec(message)?.[0] ?? 'CG-9001')
  const status = code === 'CG-1002' ? 413 : code === 'CG-1003' ? 404 : 400
  return jsonResponse(status, { error: { code, message } })
}

export async function dispatchClassGraphApi(
  request: ClassGraphApiRequest,
  options: ClassGraphApiOptions = {},
): Promise<ClassGraphApiResponse> {
  const { method, path, body } = request
  const { assistanceProvider, projectStore, desktopQuit } = options

  try {
    if (method === 'GET' && path === '/api/health') {
      return jsonResponse(200, {
        ok: true,
        service: 'ClassGraph',
        schemaVersion: '1.0',
        transport: options.desktop ? 'desktop-ipc' : 'http',
      })
    }

    if (method === 'GET' && path === '/api/desktop/status') {
      return jsonResponse(200, { desktop: options.desktop === true })
    }

    if (method === 'POST' && path === '/api/desktop/quit') {
      if (!desktopQuit) throw new Error('CG-2013 desktop quit is not available in this runtime')
      queueMicrotask(desktopQuit)
      return jsonResponse(200, { closing: true })
    }

    if (method === 'GET' && path === '/api/projects') {
      if (!projectStore) {
        return jsonResponse(200, {
          enabled: false,
          dataDirectory: null,
          projectsDirectory: null,
          backupsDirectory: null,
          lastProjectId: null,
          projects: [],
        })
      }
      return jsonResponse(200, await projectStore.list())
    }

    if (method === 'POST' && path === '/api/projects/open') {
      if (!projectStore) throw new Error('CG-2010 local project storage is not enabled')
      const record = expectRecord(parseJsonBody(body))
      return jsonResponse(200, {
        project: await projectStore.load(expectString(record, 'projectId')),
      })
    }

    if (method === 'GET' && path === '/api/assistance/status') {
      return jsonResponse(200, assistanceServiceStatus(assistanceProvider))
    }

    if (method === 'POST' && path === '/api/assistance/preview') {
      const record = expectRecord(parseJsonBody(body))
      const requestEnvelope = buildAssistanceRequest(
        {
          project: parseProjectFromRequest(record),
          task: parseAssistanceTask(record),
          mode: parseAssistanceMode(record),
          prompt: optionalString(record, 'prompt'),
          requestId: optionalString(record, 'requestId'),
        },
        assistanceProvider,
      )
      return jsonResponse(200, { request: requestEnvelope })
    }

    if (method === 'POST' && path === '/api/assistance/run') {
      const record = expectRecord(parseJsonBody(body))
      const result = await runAssistance(
        {
          project: parseProjectFromRequest(record),
          task: parseAssistanceTask(record),
          mode: parseAssistanceMode(record),
          prompt: optionalString(record, 'prompt'),
          requestId: optionalString(record, 'requestId'),
          confirmSend: optionalBoolean(record, 'confirmSend') === true,
        },
        assistanceProvider,
      )
      return jsonResponse(200, result)
    }

    if (method === 'POST' && path === '/api/assistance/accept-synthetic') {
      const record = expectRecord(parseJsonBody(body))
      return jsonResponse(200, { specification: acceptSyntheticSpecDraft(record.proposal) })
    }

    if (method === 'POST' && path === '/api/assistance/accept-planning') {
      const record = expectRecord(parseJsonBody(body))
      return jsonResponse(200, {
        accepted: acceptPlanningRuleSuggestions(
          record.proposal,
          requiredIndexArray(record, 'selectedIndexes'),
        ),
      })
    }

    if (method === 'POST' && path === '/api/project/create') {
      const setup = parseProjectSetup(parseJsonBody(body))
      const project = createEmptyProject({
        projectId: setup.projectId,
        title: setup.title,
        now: new Date().toISOString(),
        classInfo: setup.classInfo,
      })
      await projectStore?.save(project)
      return jsonResponse(200, { project })
    }

    if (method === 'POST' && path === '/api/project/mutate') {
      const mutation = parseProjectMutationRequest(parseJsonBody(body))
      const project = applyProjectMutation(
        mutation.project,
        mutation.command,
        new Date().toISOString(),
      )
      await projectStore?.save(project)
      return jsonResponse(200, { project })
    }

    if (method === 'POST' && path === '/api/synthetic/generate') {
      const specification = parseStructuredSyntheticRequest(parseJsonBody(body))
      const project = generateSyntheticProject({
        ...specification,
        generatedAt: new Date().toISOString(),
      })
      await projectStore?.save(project)
      return jsonResponse(200, { project })
    }

    if (method === 'POST' && path === '/api/planning/seating') {
      const record = expectRecord(parseJsonBody(body))
      const project = parseProjectFromRequest(record)
      return jsonResponse(200, {
        result: generateSeatingCandidates(project, {
          seed: optionalString(record, 'seed'),
          candidateCount: optionalPositiveInteger(record, 'candidateCount'),
          attempts: optionalPositiveInteger(record, 'attempts'),
        }),
      })
    }

    if (method === 'POST' && path === '/api/planning/grouping') {
      const record = expectRecord(parseJsonBody(body))
      const project = parseProjectFromRequest(record)
      return jsonResponse(200, {
        result: generateGroupingCandidates(project, {
          groupCount: requiredPositiveInteger(record, 'groupCount'),
          seed: optionalString(record, 'seed'),
          metricKey: optionalString(record, 'metricKey'),
          candidateCount: optionalPositiveInteger(record, 'candidateCount'),
          attempts: optionalPositiveInteger(record, 'attempts'),
        }),
      })
    }

    if (method === 'POST' && path === '/api/analysis/project') {
      const record = expectRecord(parseJsonBody(body))
      return jsonResponse(200, {
        analysis: buildProjectAnalysis(parseProjectFromRequest(record)),
      })
    }

    if (method === 'POST' && path === '/api/planning/history-analysis') {
      const record = expectRecord(parseJsonBody(body))
      return jsonResponse(200, {
        history: buildRepeatNeighbourHistory(parseProjectFromRequest(record)),
      })
    }

    if (method === 'POST' && path === '/api/planning/scenario-comparison') {
      const record = expectRecord(parseJsonBody(body))
      const project = parseProjectFromRequest(record)
      return jsonResponse(200, {
        comparison: comparePlanningScenarios(
          project,
          expectString(record, 'leftScenarioId'),
          expectString(record, 'rightScenarioId'),
        ),
      })
    }

    if (method === 'POST' && path === '/api/relationships/graph') {
      const record = expectRecord(parseJsonBody(body))
      return jsonResponse(200, {
        graph: buildRelationshipGraph(
          parseProjectFromRequest(record),
          optionalString(record, 'focusStudentId'),
        ),
      })
    }

    if (method === 'POST' && path === '/api/analysis/scatter') {
      const record = expectRecord(parseJsonBody(body))
      return jsonResponse(200, {
        scatter: buildScatterView(
          parseProjectFromRequest(record),
          expectString(record, 'xMetricKey'),
          expectString(record, 'yMetricKey'),
        ),
      })
    }

    if (method === 'POST' && path === '/api/analysis/crosstab') {
      const record = expectRecord(parseJsonBody(body))
      return jsonResponse(200, {
        crossTab: buildCrossTab(
          parseProjectFromRequest(record),
          expectString(record, 'rowMetricKey'),
          expectString(record, 'columnMetricKey'),
        ),
      })
    }

    if (method === 'POST' && path === '/api/analysis/group-summary') {
      const record = expectRecord(parseJsonBody(body))
      return jsonResponse(200, {
        groupSummary: buildGroupSummary(
          parseProjectFromRequest(record),
          expectString(record, 'metricKey'),
          expectGroupingBasis(record),
        ),
      })
    }

    if (
      method === 'POST' &&
      [
        '/api/export/project-json',
        '/api/export/analysis-json',
        '/api/export/seating-json',
        '/api/export/eduboard-json',
        '/api/export/docx',
        '/api/export/pdf',
        '/api/export/seating-pdf',
      ].includes(path)
    ) {
      const record = expectRecord(parseJsonBody(body))
      const project = parseProjectFromRequest(record)
      const stem = safeExportStem(project.title)

      if (path === '/api/export/project-json') {
        return downloadResponse(
          serializeProjectJson(project),
          'application/json; charset=utf-8',
          `${stem}.classgraph.json`,
        )
      }
      if (path === '/api/export/analysis-json') {
        return downloadResponse(
          serializeAnalysisExport(project),
          'application/json; charset=utf-8',
          `${stem}-analysis.json`,
        )
      }
      if (path === '/api/export/seating-json') {
        return downloadResponse(
          serializeSeatingPlanExport(project),
          'application/json; charset=utf-8',
          `${stem}-seating-plan.json`,
        )
      }
      if (path === '/api/export/eduboard-json') {
        return downloadResponse(
          serializeEduBoardHandback(project),
          'application/json; charset=utf-8',
          `${stem}-eduboard-handback.json`,
        )
      }
      if (path === '/api/export/docx') {
        return downloadResponse(
          await generateDocxReport(project),
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          `${stem}-report.docx`,
        )
      }
      if (path === '/api/export/pdf') {
        return downloadResponse(
          await generatePdfReport(project),
          'application/pdf',
          `${stem}-report.pdf`,
        )
      }
      return downloadResponse(
        await generateSeatingPlanPdf(project),
        'application/pdf',
        `${stem}-seating-plan.pdf`,
      )
    }

    if (method === 'POST' && path === '/api/import/table/read') {
      const record = expectRecord(parseJsonBody(body))
      const fileName = expectString(record, 'fileName')
      const bytes = Buffer.from(expectString(record, 'dataBase64'), 'base64')
      const table = await readTableFile(fileName, new Uint8Array(bytes))
      const existing = record.project === undefined ? undefined : parseProjectFromRequest(record)
      return jsonResponse(200, {
        table,
        suggestions: table.sheets.map((sheet) => suggestTableImport(sheet.rows, existing)),
      })
    }

    if (method === 'POST' && path === '/api/import/table/suggest') {
      const record = expectRecord(parseJsonBody(body))
      const request = parseTableImportRequest({ ...expectRecord(record.request), columns: [] })
      const existing = record.project === undefined ? undefined : parseProjectFromRequest(record)
      return jsonResponse(200, {
        suggestion: suggestTableImport(request.rows, existing, request.headerRow),
      })
    }

    if (method === 'POST' && path === '/api/import/table/preview') {
      const record = expectRecord(parseJsonBody(body))
      const request = parseTableImportRequest(record.request)
      const existing = record.project === undefined ? undefined : parseProjectFromRequest(record)
      return jsonResponse(200, { plan: planTableImport(request, existing) })
    }

    if (method === 'POST' && path === '/api/import/table/apply') {
      const record = expectRecord(parseJsonBody(body))
      const request = parseTableImportRequest(record.request)
      const now = new Date().toISOString()
      const project =
        record.project === undefined
          ? applyTableImport(request, {
              mode: 'new-project',
              projectId: expectString(record, 'projectId'),
              title: expectString(record, 'title'),
              now,
            })
          : applyTableImport(request, {
              mode: 'merge',
              project: parseProjectFromRequest(record),
              now,
            })
      await projectStore?.save(project)
      return jsonResponse(200, { project })
    }

    if (method === 'POST' && path === '/api/import') {
      const project = parseProjectJson(body ?? '')
      await projectStore?.save(project)
      return jsonResponse(200, { project })
    }

    if (method === 'POST' && path === '/api/export') {
      const project = parseProjectJson(body ?? '')
      return downloadResponse(
        serializeProjectJson(project),
        'application/json; charset=utf-8',
        'classgraph-project.classgraph.json',
      )
    }

    return jsonResponse(404, {
      error: { code: 'CG-1003', message: 'ClassGraph could not find that route.' },
    })
  } catch (error) {
    return apiError(error)
  }
}
