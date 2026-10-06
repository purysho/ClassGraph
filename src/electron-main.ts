import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { dispatchClassGraphApi, type ClassGraphApiRequest } from './api-dispatch.js'
import { createEnvironmentAssistanceProvider } from './assistance-provider.js'
import { parseProjectJson, serializeProjectJson } from './json.js'
import { createEmptyProject } from './workspace.js'
import {
  defaultClassGraphDataDirectory,
  FileProjectStore,
  safeProjectFileStem,
  visibleClassGraphDirectory,
} from './project-store.js'

interface DesktopApiResponse {
  status: number
  contentType: string
  filename?: string
  bodyText?: string
  bodyBase64?: string
}

let mainWindow: BrowserWindow | null = null

function packagedAsset(...parts: string[]): string {
  return join(app.getAppPath(), ...parts)
}

function serializeDesktopResponse(
  response: Awaited<ReturnType<typeof dispatchClassGraphApi>>,
): DesktopApiResponse {
  if (typeof response.body === 'string') {
    return {
      status: response.status,
      contentType: response.contentType,
      ...(response.filename ? { filename: response.filename } : {}),
      bodyText: response.body,
    }
  }

  return {
    status: response.status,
    contentType: response.contentType,
    ...(response.filename ? { filename: response.filename } : {}),
    bodyBase64: Buffer.from(response.body).toString('base64'),
  }
}

async function createProjectStore(): Promise<FileProjectStore> {
  const documentsRoot = visibleClassGraphDirectory(app.getPath('documents'))
  const store = new FileProjectStore(documentsRoot)
  await store.initialize()
  await store.migrateFromLegacy(defaultClassGraphDataDirectory())
  return store
}

function createWindow(showWhenReady = true): BrowserWindow {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    show: false,
    title: 'ClassGraph',
    backgroundColor: '#17212a',
    icon: packagedAsset('build', 'icon.png'),
    webPreferences: {
      preload: packagedAsset('dist', 'electron-preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  window.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('file://')) event.preventDefault()
  })
  if (showWhenReady) window.once('ready-to-show', () => window.show())
  void window.loadFile(packagedAsset('app', 'index.html'))

  return window
}

async function runSelfTest(store: FileProjectStore): Promise<void> {
  const response = await dispatchClassGraphApi(
    { method: 'GET', path: '/api/health' },
    { projectStore: store, desktop: true },
  )
  if (response.status !== 200 || typeof response.body !== 'string') {
    throw new Error('ClassGraph native desktop self-test failed.')
  }

  const health = JSON.parse(response.body) as { ok?: boolean; transport?: string }
  if (health.ok !== true || health.transport !== 'desktop-ipc') {
    throw new Error('ClassGraph native desktop self-test returned an unexpected transport.')
  }

  // Exercises the packaged CJK PDF font: it must be found inside the installed app.
  const pdf = await dispatchClassGraphApi(
    {
      method: 'POST',
      path: '/api/export/pdf',
      body: JSON.stringify({
        project: createEmptyProject({
          projectId: 'pdf-self-test',
          title: '五年级 英语 Self Test',
          now: new Date().toISOString(),
        }),
      }),
    },
    { projectStore: store, desktop: true },
  )
  const signature =
    pdf.body instanceof Uint8Array ? new TextDecoder('latin1').decode(pdf.body.slice(0, 5)) : ''
  if (pdf.status !== 200 || signature !== '%PDF-') {
    throw new Error(
      `ClassGraph native PDF self-test failed: ${typeof pdf.body === 'string' ? pdf.body : pdf.status}`,
    )
  }

  console.log('ClassGraph native desktop self-test passed.')
}

async function runRendererSelfTest(): Promise<void> {
  const window = createWindow(false)

  await new Promise<void>((resolve, reject) => {
    window.webContents.once('did-finish-load', () => resolve())
    window.webContents.once('did-fail-load', (_event, code, description) => {
      reject(new Error(`Renderer self-test failed to load: ${code} ${description}`))
    })
  })

  const result = (await window.webContents.executeJavaScript(`
    (async () => {
      const bridge = window.classGraphDesktop
      if (!bridge) return { ok: false, reason: 'preload bridge missing' }

      const response = await bridge.request({
        method: 'POST',
        path: '/api/project/create',
        body: JSON.stringify({
          projectId: 'renderer-self-test',
          title: 'Renderer Self Test',
          classInfo: { subject: 'Self Test' }
        })
      })

      if (response.status !== 200 || typeof response.bodyText !== 'string') {
        return { ok: false, reason: 'unexpected desktop API response' }
      }

      const parsed = JSON.parse(response.bodyText)
      return {
        ok: parsed?.project?.projectId === 'renderer-self-test',
        reason: parsed?.project?.title ?? 'project missing'
      }
    })()
  `)) as { ok?: boolean; reason?: string }

  if (result.ok !== true) {
    throw new Error(
      `ClassGraph renderer/preload self-test failed: ${result.reason ?? 'unknown error'}`,
    )
  }

  console.log('ClassGraph renderer/preload self-test passed.')
  window.destroy()
}

async function start(): Promise<void> {
  const gotLock = app.requestSingleInstanceLock()
  if (!gotLock) {
    app.quit()
    return
  }

  app.on('second-instance', () => {
    if (!mainWindow) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.show()
    mainWindow.focus()
  })

  await app.whenReady()
  process.env.CLASSGRAPH_ASSETS_DIR ??= packagedAsset('assets')
  const store = await createProjectStore()
  const assistanceProvider = createEnvironmentAssistanceProvider()

  ipcMain.handle('classgraph:request', async (_event, request: ClassGraphApiRequest) => {
    const response = await dispatchClassGraphApi(request, {
      assistanceProvider,
      projectStore: store,
      desktop: true,
      desktopQuit: () => app.quit(),
    })
    return serializeDesktopResponse(response)
  })

  ipcMain.handle(
    'classgraph:save-project-copy',
    async (_event, serializedProject: string, suggestedTitle: string) => {
      const project = parseProjectJson(serializedProject)
      const backupDirectory = join(app.getPath('documents'), 'ClassGraph', 'Backups')
      await mkdir(backupDirectory, { recursive: true })

      const result = await dialog.showSaveDialog({
        title: 'Save ClassGraph Backup',
        defaultPath: join(
          backupDirectory,
          `${safeProjectFileStem(suggestedTitle || project.title)}.classgraph.json`,
        ),
        filters: [{ name: 'ClassGraph Project', extensions: ['classgraph.json', 'json'] }],
      })

      if (result.canceled || !result.filePath) return { canceled: true }
      await writeFile(result.filePath, serializeProjectJson(project), 'utf8')
      return { canceled: false, filePath: result.filePath }
    },
  )

  if (process.argv.includes('--self-test')) {
    await runSelfTest(store)
    await runRendererSelfTest()
    app.quit()
    return
  }

  mainWindow = createWindow()
  mainWindow.on('closed', () => {
    mainWindow = null
  })

  app.on('activate', () => {
    if (!mainWindow) mainWindow = createWindow()
  })
}

app.on('window-all-closed', () => {
  app.quit()
})

void start().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`ClassGraph could not start: ${message}`)
  app.exit(1)
})
