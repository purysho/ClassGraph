import { spawn } from 'node:child_process'
import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { getAsset, isSea } from 'node:sea'
import { createEnvironmentAssistanceProvider } from './assistance-provider.js'
import { FileProjectStore } from './project-store.js'
import { createClassGraphServer, type StaticAssetMap } from './server.js'

const DEFAULT_PORT = 4317
const LOOPBACK_HOST = '127.0.0.1'

function embeddedAssets(): StaticAssetMap | undefined {
  if (!isSea()) return undefined

  const asset = (key: string): Uint8Array => new Uint8Array(getAsset(key))
  return {
    '/index.html': asset('index.html'),
    '/styles.css': asset('styles.css'),
    '/app.js': asset('app.js'),
  }
}

function requestedPort(): number {
  const value = Number(process.env.CLASSGRAPH_PORT ?? String(DEFAULT_PORT))
  return Number.isInteger(value) && value >= 0 && value <= 65535 ? value : DEFAULT_PORT
}

function listen(server: Server, port: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const onError = (error: Error) => {
      server.off('listening', onListening)
      reject(error)
    }
    const onListening = () => {
      server.off('error', onError)
      const address = server.address() as AddressInfo
      resolve(address.port)
    }

    server.once('error', onError)
    server.once('listening', onListening)
    server.listen(port, LOOPBACK_HOST)
  })
}

async function existingInstanceUrl(port: number): Promise<string | null> {
  if (port <= 0) return null
  const url = `http://${LOOPBACK_HOST}:${port}`

  try {
    const response = await fetch(`${url}/api/health`, {
      signal: AbortSignal.timeout(700),
    })
    if (!response.ok) return null
    const health = (await response.json()) as { ok?: boolean; service?: string }
    return health.ok === true && health.service === 'ClassGraph' ? url : null
  } catch {
    return null
  }
}

async function listenWithFallback(server: Server): Promise<number> {
  const preferredPort = requestedPort()
  try {
    return await listen(server, preferredPort)
  } catch (error) {
    const code = error instanceof Error && 'code' in error ? String(error.code) : ''
    if (code !== 'EADDRINUSE' || preferredPort === 0) throw error
    return listen(server, 0)
  }
}

function openBrowser(url: string): void {
  const command =
    process.platform === 'win32'
      ? { file: 'cmd.exe', args: ['/d', '/s', '/c', 'start', '', url] }
      : process.platform === 'darwin'
        ? { file: 'open', args: [url] }
        : { file: 'xdg-open', args: [url] }

  try {
    const child = spawn(command.file, command.args, {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    })
    child.unref()
  } catch {
    console.warn(`Open this address in a browser: ${url}`)
  }
}

async function selfTest(): Promise<void> {
  const server = createClassGraphServer({
    staticAssets: embeddedAssets(),
    assistanceProvider: createEnvironmentAssistanceProvider(),
  })

  try {
    const port = await listen(server, 0)
    const base = `http://${LOOPBACK_HOST}:${port}`
    const [healthResponse, shellResponse] = await Promise.all([
      fetch(`${base}/api/health`),
      fetch(base),
    ])

    if (!healthResponse.ok || !shellResponse.ok) {
      throw new Error('Desktop self-test could not reach the embedded ClassGraph server.')
    }

    const health = (await healthResponse.json()) as { ok?: boolean; service?: string }
    const html = await shellResponse.text()
    if (
      health.ok !== true ||
      health.service !== 'ClassGraph' ||
      !html.includes('<div id="app"></div>')
    ) {
      throw new Error('Desktop self-test received an unexpected embedded response.')
    }

    console.log('ClassGraph desktop self-test passed.')
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()))
  }
}

async function main(): Promise<void> {
  if (process.argv.includes('--self-test')) {
    await selfTest()
    return
  }

  const preferredPort = requestedPort()
  const runningUrl = await existingInstanceUrl(preferredPort)
  if (runningUrl) {
    openBrowser(runningUrl)
    return
  }

  const server = createClassGraphServer({
    staticAssets: embeddedAssets(),
    assistanceProvider: createEnvironmentAssistanceProvider(),
    projectStore: new FileProjectStore(),
  })
  const port = await listenWithFallback(server)
  const url = `http://${LOOPBACK_HOST}:${port}`
  console.log(`ClassGraph is running locally at ${url}`)
  openBrowser(url)
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`ClassGraph could not start: ${message}`)
  process.exitCode = 1
})
