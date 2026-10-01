import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join } from 'node:path'
import { buildProjectAnalysis, buildScatterView } from './analysis-view.js'
import {
  acceptPlanningRuleSuggestions,
  acceptSyntheticSpecDraft,
} from './assistance-acceptance.js'
import type { AssistanceExecutionMode, AssistanceTask } from './assistance-contract.js'
import type { AssistanceProvider } from './assistance-provider.js'
import {
  assistanceServiceStatus,
  buildAssistanceRequest,
  runAssistance,
} from './assistance-service.js'
import { generateGroupingCandidates } from './grouping.js'
import { serializeEduBoardHandback } from './eduboard-handback.js'
import { ClassGraphExportError } from './export-errors.js'
import {
  safeExportStem,
  serializeAnalysisExport,
  serializeSeatingPlanExport,
} from './export-json.js'
import { ClassGraphImportError, parseProjectJson, serializeProjectJson } from './json.js'
import { generateSeatingCandidates } from './planning.js'
import { buildRepeatNeighbourHistory } from './planning-history.js'
import { comparePlanningScenarios } from './planning-scenarios.js'
import { generateDocxReport } from './report-docx.js'
import { buildRelationshipGraph } from './relationship-graph.js'
import { generatePdfReport, generateSeatingPlanPdf } from './report-pdf.js'
import { applyProjectMutation, parseProjectMutationRequest } from './project-mutations.js'
import { classGraphProjectSchema } from './schema.js'
import { parseStructuredSyntheticRequest } from './synthetic-request.js'
import { generateSyntheticProject } from './synthetic.js'
import { createEmptyProject } from './workspace.js'

export interface ClassGraphServerOptions {
  appDirectory?: string
  buildDirectory?: string
  maxBodyBytes?: number
  assistanceProvider?: AssistanceProvider
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

const DEFAULT_MAX_BODY_BYTES = 5 * 1024 * 1024

function send(
  response: ServerResponse,
  statusCode: number,
  body: string,
  contentType = 'application/json; charset=utf-8',
): void {
  response.writeHead(statusCode, {
    'Content-Type': contentType,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
  })
  response.end(body)
}

function sendJson(response: ServerResponse, statusCode: number, value: unknown): void {
  send(response, statusCode, JSON.stringify(value))
}

function asciiDownloadName(filename: string): string {
  return [...filename]
    .map((character) => {
      const code = character.codePointAt(0) ?? 0
      if (code < 32 || code > 126 || character === '"' || character === '\\') return '_'
      return character
    })
    .join('')
}

function downloadDisposition(filename: string): string {
  const ascii = asciiDownloadName(filename) || 'classgraph-export'
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`
}

function sendDownload(
  response: ServerResponse,
  body: string | Uint8Array,
  contentType: string,
  filename: string,
): void {
  response.writeHead(200, {
    'Content-Type': contentType,
    'Content-Disposition': downloadDisposition(filename),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
  })
  response.end(body)
}

async function readBody(request: IncomingMessage, maxBodyBytes: number): Promise<string> {
  const chunks: Uint8Array[] = []
  let total = 0

  for await (const chunk of request) {
    const buffer = Buffer.from(chunk)
    total += buffer.length
    if (total > maxBodyBytes) {
      throw new Error('CG-1002 request body is too large')
    }
    chunks.push(buffer)
  }

  return Buffer.concat(chunks).toString('utf8')
}

async function readJsonBody(request: IncomingMessage, maxBodyBytes: number): Promise<unknown> {
  const body = await readBody(request, maxBodyBytes)
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

function optionalBoolean(record: Record<string, unknown>, key: string): boolean | undefined {
  const value = record[key]
  if (value === undefined) return undefined
  if (typeof value !== 'boolean') throw new Error(`CG-6001 ${key} must be a boolean`)
  return value
}

function requiredIndexArray(record: Record<string, unknown>, key: string): number[] {
  const value = record[key]
  if (
    !Array.isArray(value) ||
    value.some((item) => typeof item !== 'number' || !Number.isInteger(item) || item < 0)
  ) {
    throw new Error(`CG-6001 ${key} must be an array of non-negative integer indexes`)
  }
  return value
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

function contentTypeFor(path: string): string {
  switch (extname(path)) {
    case '.html':
      return 'text/html; charset=utf-8'
    case '.css':
      return 'text/css; charset=utf-8'
    case '.js':
      return 'text/javascript; charset=utf-8'
    default:
      return 'application/octet-stream'
  }
}

async function sendFile(response: ServerResponse, filePath: string): Promise<void> {
  const body = await readFile(filePath)
  response.writeHead(200, {
    'Content-Type': contentTypeFor(filePath),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
  })
  response.end(body)
}

async function serveStatic(
  response: ServerResponse,
  appDirectory: string,
  buildDirectory: string,
  pathname: string,
): Promise<boolean> {
  const appAssets: Record<string, string> = {
    '/': 'index.html',
    '/index.html': 'index.html',
    '/styles.css': 'styles.css',
  }

  try {
    if (pathname === '/app.js') {
      await sendFile(response, join(buildDirectory, 'app-client.js'))
      return true
    }

    const filename = appAssets[pathname]
    if (!filename) return false
    await sendFile(response, join(appDirectory, filename))
    return true
  } catch {
    sendJson(response, 404, {
      error: { code: 'CG-1004', message: 'The local ClassGraph UI asset was not found.' },
    })
    return true
  }
}

export function createClassGraphServer(options: ClassGraphServerOptions = {}): Server {
  const appDirectory = options.appDirectory ?? join(process.cwd(), 'app')
  const buildDirectory = options.buildDirectory ?? join(process.cwd(), 'dist')
  const maxBodyBytes = options.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES
  const assistanceProvider = options.assistanceProvider

  return createServer((request, response) => {
    void (async () => {
      const url = new URL(request.url ?? '/', 'http://127.0.0.1')

      try {
        if (request.method === 'GET' && url.pathname === '/api/health') {
          sendJson(response, 200, {
            ok: true,
            service: 'ClassGraph',
            schemaVersion: '1.0',
          })
          return
        }

        if (request.method === 'GET' && url.pathname === '/api/assistance/status') {
          sendJson(response, 200, assistanceServiceStatus(assistanceProvider))
          return
        }

        if (request.method === 'POST' && url.pathname === '/api/assistance/preview') {
          const record = expectRecord(await readJsonBody(request, maxBodyBytes))
          const project = parseProjectFromRequest(record)
          const task = parseAssistanceTask(record)
          const mode = parseAssistanceMode(record)
          const requestEnvelope = buildAssistanceRequest(
            {
              project,
              task,
              mode,
              prompt: optionalString(record, 'prompt'),
              requestId: optionalString(record, 'requestId'),
            },
            assistanceProvider,
          )
          sendJson(response, 200, { request: requestEnvelope })
          return
        }

        if (request.method === 'POST' && url.pathname === '/api/assistance/run') {
          const record = expectRecord(await readJsonBody(request, maxBodyBytes))
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
          sendJson(response, 200, result)
          return
        }

        if (request.method === 'POST' && url.pathname === '/api/assistance/accept-synthetic') {
          const record = expectRecord(await readJsonBody(request, maxBodyBytes))
          const specification = acceptSyntheticSpecDraft(record.proposal)
          sendJson(response, 200, { specification })
          return
        }

        if (request.method === 'POST' && url.pathname === '/api/assistance/accept-planning') {
          const record = expectRecord(await readJsonBody(request, maxBodyBytes))
          const accepted = acceptPlanningRuleSuggestions(
            record.proposal,
            requiredIndexArray(record, 'selectedIndexes'),
          )
          sendJson(response, 200, { accepted })
          return
        }

        if (request.method === 'POST' && url.pathname === '/api/project/create') {
          const setup = parseProjectSetup(await readJsonBody(request, maxBodyBytes))
          const project = createEmptyProject({
            projectId: setup.projectId,
            title: setup.title,
            now: new Date().toISOString(),
            classInfo: setup.classInfo,
          })
          sendJson(response, 200, { project })
          return
        }

        if (request.method === 'POST' && url.pathname === '/api/project/mutate') {
          const mutation = parseProjectMutationRequest(await readJsonBody(request, maxBodyBytes))
          const project = applyProjectMutation(
            mutation.project,
            mutation.command,
            new Date().toISOString(),
          )
          sendJson(response, 200, { project })
          return
        }

        if (request.method === 'POST' && url.pathname === '/api/synthetic/generate') {
          const specification = parseStructuredSyntheticRequest(
            await readJsonBody(request, maxBodyBytes),
          )
          const project = generateSyntheticProject({
            ...specification,
            generatedAt: new Date().toISOString(),
          })
          sendJson(response, 200, { project })
          return
        }

        if (request.method === 'POST' && url.pathname === '/api/planning/seating') {
          const record = expectRecord(await readJsonBody(request, maxBodyBytes))
          const project = parseProjectFromRequest(record)
          const result = generateSeatingCandidates(project, {
            seed: optionalString(record, 'seed'),
            candidateCount: optionalPositiveInteger(record, 'candidateCount'),
            attempts: optionalPositiveInteger(record, 'attempts'),
          })
          sendJson(response, 200, { result })
          return
        }

        if (request.method === 'POST' && url.pathname === '/api/planning/grouping') {
          const record = expectRecord(await readJsonBody(request, maxBodyBytes))
          const project = parseProjectFromRequest(record)
          const result = generateGroupingCandidates(project, {
            groupCount: requiredPositiveInteger(record, 'groupCount'),
            seed: optionalString(record, 'seed'),
            metricKey: optionalString(record, 'metricKey'),
            candidateCount: optionalPositiveInteger(record, 'candidateCount'),
            attempts: optionalPositiveInteger(record, 'attempts'),
          })
          sendJson(response, 200, { result })
          return
        }

        if (request.method === 'POST' && url.pathname === '/api/analysis/project') {
          const record = expectRecord(await readJsonBody(request, maxBodyBytes))
          const analysis = buildProjectAnalysis(parseProjectFromRequest(record))
          sendJson(response, 200, { analysis })
          return
        }

        if (request.method === 'POST' && url.pathname === '/api/planning/history-analysis') {
          const record = expectRecord(await readJsonBody(request, maxBodyBytes))
          const project = parseProjectFromRequest(record)
          sendJson(response, 200, { history: buildRepeatNeighbourHistory(project) })
          return
        }

        if (request.method === 'POST' && url.pathname === '/api/planning/scenario-comparison') {
          const record = expectRecord(await readJsonBody(request, maxBodyBytes))
          const project = parseProjectFromRequest(record)
          const comparison = comparePlanningScenarios(
            project,
            expectString(record, 'leftScenarioId'),
            expectString(record, 'rightScenarioId'),
          )
          sendJson(response, 200, { comparison })
          return
        }

        if (request.method === 'POST' && url.pathname === '/api/relationships/graph') {
          const record = expectRecord(await readJsonBody(request, maxBodyBytes))
          const project = parseProjectFromRequest(record)
          const graph = buildRelationshipGraph(project, optionalString(record, 'focusStudentId'))
          sendJson(response, 200, { graph })
          return
        }

        if (request.method === 'POST' && url.pathname === '/api/analysis/scatter') {
          const record = expectRecord(await readJsonBody(request, maxBodyBytes))
          const project = parseProjectFromRequest(record)
          const xMetricKey = expectString(record, 'xMetricKey')
          const yMetricKey = expectString(record, 'yMetricKey')
          const scatter = buildScatterView(project, xMetricKey, yMetricKey)
          sendJson(response, 200, { scatter })
          return
        }

        if (
          request.method === 'POST' &&
          [
            '/api/export/project-json',
            '/api/export/analysis-json',
            '/api/export/seating-json',
            '/api/export/eduboard-json',
            '/api/export/docx',
            '/api/export/pdf',
            '/api/export/seating-pdf',
          ].includes(url.pathname)
        ) {
          const record = expectRecord(await readJsonBody(request, maxBodyBytes))
          const project = parseProjectFromRequest(record)
          const stem = safeExportStem(project.title)

          if (url.pathname === '/api/export/project-json') {
            sendDownload(
              response,
              serializeProjectJson(project),
              'application/json; charset=utf-8',
              `${stem}.classgraph.json`,
            )
            return
          }
          if (url.pathname === '/api/export/analysis-json') {
            sendDownload(
              response,
              serializeAnalysisExport(project),
              'application/json; charset=utf-8',
              `${stem}-analysis.json`,
            )
            return
          }
          if (url.pathname === '/api/export/seating-json') {
            sendDownload(
              response,
              serializeSeatingPlanExport(project),
              'application/json; charset=utf-8',
              `${stem}-seating-plan.json`,
            )
            return
          }
          if (url.pathname === '/api/export/eduboard-json') {
            sendDownload(
              response,
              serializeEduBoardHandback(project),
              'application/json; charset=utf-8',
              `${stem}-eduboard-handback.json`,
            )
            return
          }
          if (url.pathname === '/api/export/docx') {
            sendDownload(
              response,
              await generateDocxReport(project),
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
              `${stem}-report.docx`,
            )
            return
          }
          if (url.pathname === '/api/export/pdf') {
            sendDownload(
              response,
              await generatePdfReport(project),
              'application/pdf',
              `${stem}-report.pdf`,
            )
            return
          }
          sendDownload(
            response,
            await generateSeatingPlanPdf(project),
            'application/pdf',
            `${stem}-seating-plan.pdf`,
          )
          return
        }

        if (request.method === 'POST' && url.pathname === '/api/import') {
          const body = await readBody(request, maxBodyBytes)
          const project = parseProjectJson(body)
          sendJson(response, 200, { project })
          return
        }

        if (request.method === 'POST' && url.pathname === '/api/export') {
          const body = await readBody(request, maxBodyBytes)
          const project = parseProjectJson(body)
          response.writeHead(200, {
            'Content-Type': 'application/json; charset=utf-8',
            'Content-Disposition': 'attachment; filename="classgraph-project.json"',
            'Cache-Control': 'no-store',
            'X-Content-Type-Options': 'nosniff',
            'Referrer-Policy': 'no-referrer',
          })
          response.end(serializeProjectJson(project))
          return
        }

        if (
          request.method === 'GET' &&
          (await serveStatic(response, appDirectory, buildDirectory, url.pathname))
        ) {
          return
        }

        sendJson(response, 404, {
          error: { code: 'CG-1003', message: 'ClassGraph could not find that local route.' },
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unexpected local server error.'
        const code =
          error instanceof ClassGraphImportError || error instanceof ClassGraphExportError
            ? error.code
            : (/^CG-\d{4}/.exec(message)?.[0] ?? 'CG-9001')
        const statusCode = code === 'CG-1002' ? 413 : 400
        sendJson(response, statusCode, { error: { code, message } })
      }
    })()
  })
}
