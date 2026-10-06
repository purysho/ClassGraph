import { readFile } from 'node:fs/promises'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { extname, join } from 'node:path'
import { dispatchClassGraphApi, type ClassGraphApiResponse } from './api-dispatch.js'
import type { AssistanceProvider } from './assistance-provider.js'
import type { FileProjectStore } from './project-store.js'

/** Modules app-client.js imports, directly or through another module. */
const CLIENT_RUNTIME_MODULES = new Set([
  'api-client-transport.js',
  'i18n.js',
  'i18n-zh.js',
  'i18n-zh-errors.js',
  'i18n-zh-server.js',
])

export type StaticAssetMap = Readonly<Record<string, Uint8Array>>

export interface ClassGraphServerOptions {
  appDirectory?: string
  buildDirectory?: string
  maxBodyBytes?: number
  assistanceProvider?: AssistanceProvider
  staticAssets?: StaticAssetMap
  projectStore?: FileProjectStore
  desktopQuit?: () => void
}

const DEFAULT_MAX_BODY_BYTES = 5 * 1024 * 1024

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

function sendApiResponse(response: ServerResponse, result: ClassGraphApiResponse): void {
  response.writeHead(result.status, {
    'Content-Type': result.contentType,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    ...(result.filename ? { 'Content-Disposition': downloadDisposition(result.filename) } : {}),
  })
  response.end(result.body)
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
  staticAssets?: StaticAssetMap,
): Promise<boolean> {
  const normalizedPath = pathname === '/' ? '/index.html' : pathname
  const embedded = staticAssets?.[normalizedPath]

  if (embedded) {
    response.writeHead(200, {
      'Content-Type': contentTypeFor(normalizedPath),
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
    })
    response.end(embedded)
    return true
  }

  const appAssets: Record<string, string> = {
    '/': 'index.html',
    '/index.html': 'index.html',
    '/styles.css': 'styles.css',
  }

  try {
    if (pathname === '/app.js' || pathname === '/dist/app-client.js') {
      await sendFile(response, join(buildDirectory, 'app-client.js'))
      return true
    }

    // Runtime modules imported by app-client.js; they must be served for browser development mode.
    const clientModule = /^\/dist\/([\w-]+\.js)$/.exec(pathname)?.[1]
    if (clientModule && CLIENT_RUNTIME_MODULES.has(clientModule)) {
      await sendFile(response, join(buildDirectory, clientModule))
      return true
    }

    if (pathname === '/dist/desktop-renderer-bootstrap.js') {
      await sendFile(response, join(buildDirectory, 'desktop-renderer-bootstrap.js'))
      return true
    }

    const filename = appAssets[pathname]
    if (!filename) return false
    await sendFile(response, join(appDirectory, filename))
    return true
  } catch {
    sendApiResponse(response, {
      status: 404,
      contentType: 'application/json; charset=utf-8',
      body: JSON.stringify({
        error: { code: 'CG-1004', message: 'The local ClassGraph UI asset was not found.' },
      }),
    })
    return true
  }
}

export function createClassGraphServer(options: ClassGraphServerOptions = {}): Server {
  const appDirectory = options.appDirectory ?? join(process.cwd(), 'app')
  const buildDirectory = options.buildDirectory ?? join(process.cwd(), 'dist')
  const maxBodyBytes = options.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES

  return createServer((request, response) => {
    void (async () => {
      const url = new URL(request.url ?? '/', 'http://127.0.0.1')

      try {
        if (url.pathname.startsWith('/api/')) {
          const method = request.method === 'POST' ? 'POST' : 'GET'
          const body = method === 'POST' ? await readBody(request, maxBodyBytes) : undefined
          const result = await dispatchClassGraphApi(
            { method, path: url.pathname, body },
            {
              assistanceProvider: options.assistanceProvider,
              projectStore: options.projectStore,
              desktop: options.desktopQuit !== undefined,
              desktopQuit: options.desktopQuit,
            },
          )
          sendApiResponse(response, result)
          return
        }

        if (
          request.method === 'GET' &&
          (await serveStatic(
            response,
            appDirectory,
            buildDirectory,
            url.pathname,
            options.staticAssets,
          ))
        ) {
          return
        }

        sendApiResponse(response, {
          status: 404,
          contentType: 'application/json; charset=utf-8',
          body: JSON.stringify({
            error: { code: 'CG-1003', message: 'ClassGraph could not find that local route.' },
          }),
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unexpected local server error.'
        const code = /^CG-\d{4}/.exec(message)?.[0] ?? 'CG-9001'
        sendApiResponse(response, {
          status: code === 'CG-1002' ? 413 : 400,
          contentType: 'application/json; charset=utf-8',
          body: JSON.stringify({ error: { code, message } }),
        })
      }
    })()
  })
}
