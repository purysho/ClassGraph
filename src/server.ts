import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join } from 'node:path'
import { parseProjectJson, serializeProjectJson } from './json.js'

export interface ClassGraphServerOptions {
  appDirectory?: string
  maxBodyBytes?: number
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

async function readBody(request: IncomingMessage, maxBodyBytes: number): Promise<string> {
  const chunks: Buffer[] = []
  let total = 0

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    total += buffer.length
    if (total > maxBodyBytes) {
      throw new Error('CG-1002 request body is too large')
    }
    chunks.push(buffer)
  }

  return Buffer.concat(chunks).toString('utf8')
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

async function serveStatic(
  response: ServerResponse,
  appDirectory: string,
  pathname: string,
): Promise<boolean> {
  const assetMap: Record<string, string> = {
    '/': 'index.html',
    '/index.html': 'index.html',
    '/app.js': 'app.js',
    '/styles.css': 'styles.css',
  }
  const filename = assetMap[pathname]
  if (!filename) return false

  try {
    const filePath = join(appDirectory, filename)
    const body = await readFile(filePath)
    response.writeHead(200, {
      'Content-Type': contentTypeFor(filePath),
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
    })
    response.end(body)
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
  const maxBodyBytes = options.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES

  return createServer(async (request, response) => {
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

      if (request.method === 'GET' && (await serveStatic(response, appDirectory, url.pathname))) {
        return
      }

      sendJson(response, 404, {
        error: { code: 'CG-1003', message: 'ClassGraph could not find that local route.' },
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unexpected local server error.'
      const code = message.startsWith('CG-1002') ? 'CG-1002' : 'CG-1001'
      const statusCode = code === 'CG-1002' ? 413 : 400
      sendJson(response, statusCode, { error: { code, message } })
    }
  })
}
