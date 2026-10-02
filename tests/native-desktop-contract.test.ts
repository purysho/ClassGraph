import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

describe('native desktop packaging contract', () => {
  it('opens a local file in Electron instead of starting a localhost server', async () => {
    const source = await readFile('src/electron-main.ts', 'utf8')

    expect(source).toContain('new BrowserWindow')
    expect(source).toContain('loadFile')
    expect(source).toContain('contextIsolation: true')
    expect(source).toContain('nodeIntegration: false')
    expect(source).toContain('sandbox: true')

    expect(source).not.toContain('createClassGraphServer')
    expect(source).not.toContain('.listen(')
    expect(source).not.toContain('openBrowser')
    expect(source).not.toContain('127.0.0.1')
    expect(source).not.toContain('localhost')
  })

  it('configures native ClassGraph icons and a Windows desktop shortcut', async () => {
    const config = await readFile('electron-builder.yml', 'utf8')

    expect(config).toContain('productName: ClassGraph')
    expect(config).toContain('icon: build/icon.ico')
    expect(config).toContain('icon: build/icon.icns')
    expect(config).toContain('icon: build/icon.png')
    expect(config).toContain('createDesktopShortcut: always')
    expect(config).toContain('ClassGraph-Setup.${ext}')
  })

  it('loads renderer assets from local packaged files', async () => {
    const html = await readFile('app/index.html', 'utf8')

    expect(html).not.toContain('desktop-renderer-bootstrap.js')
    expect(html).toContain('../dist/app-client.js')
    expect(html).not.toMatch(/https?:\/\//)
  })

  it('routes packaged API calls directly through the desktop bridge', async () => {
    const source = await readFile('src/app-client.ts', 'utf8')
    const transport = await readFile('src/api-client-transport.ts', 'utf8')

    expect(source).toContain('classGraphApiFetch')
    expect(transport).toContain('environment.desktopBridge.request')
    expect(transport).toContain("environment.protocol === 'file:'")
    expect(transport).toContain('CG-2014')
  })

  it('native smoke test exercises the renderer preload bridge and create route', async () => {
    const source = await readFile('src/electron-main.ts', 'utf8')

    expect(source).toContain('runRendererSelfTest')
    expect(source).toContain('window.classGraphDesktop')
    expect(source).toContain("path: '/api/project/create'")
    expect(source).toContain('ClassGraph renderer/preload self-test passed.')
  })
})
