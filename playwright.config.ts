import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { defineConfig, devices } from '@playwright/test'

/**
 * Browser end-to-end tests. They drive the same app-client code the desktop window loads, served
 * by the development HTTP server against a throwaway data folder so no real classes are touched.
 */
const dataHome = mkdtempSync(join(tmpdir(), 'classgraph-e2e-'))
const port = Number(process.env.CLASSGRAPH_E2E_PORT ?? 4427)

export default defineConfig({
  testDir: 'e2e',
  testMatch: '**/*.e2e.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    acceptDownloads: true,
    trace: 'retain-on-failure',
    ...devices['Desktop Chrome'],
    viewport: { width: 1360, height: 960 },
  },
  webServer: {
    command: 'node dist/server-main.js',
    url: `http://127.0.0.1:${port}/`,
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      CLASSGRAPH_PORT: String(port),
      XDG_DATA_HOME: dataHome,
      HOME: dataHome,
    },
  },
})
