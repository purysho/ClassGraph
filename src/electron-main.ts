import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { dispatchClassGraphApi, type ClassGraphApiRequest } from './api-dispatch.js'
import { createEnvironmentAssistanceProvider } from './assistance-provider.js'
import { parseProjectJson, serializeProjectJson } from './json.js'
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

function createWindow(): BrowserWindow {
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
  window.once('ready-to-show', () => window.show())
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

  console.log('ClassGraph native desktop self-test passed.')
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
  const store = await createProjectStore()

  if (process.argv.includes('--self-test')) {
    await runSelfTest(store)
    app.quit()
    return
  }

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
