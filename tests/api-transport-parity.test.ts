import { once } from 'node:events'
import type { AddressInfo } from 'node:net'
import { afterEach, describe, expect, it } from 'vitest'
import { dispatchClassGraphApi } from '../src/api-dispatch.js'
import { createClassGraphServer } from '../src/server.js'
import { createEmptyProject } from '../src/workspace.js'

const servers: ReturnType<typeof createClassGraphServer>[] = []

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve) => {
          server.close(() => resolve())
        }),
    ),
  )
})

async function startServer(): Promise<string> {
  const server = createClassGraphServer()
  servers.push(server)
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address() as AddressInfo
  return `http://127.0.0.1:${address.port}`
}

describe('transport-independent ClassGraph API', () => {
  it('returns the same descriptive analysis over direct dispatch and development HTTP', async () => {
    const project = createEmptyProject({
      projectId: 'parity-project',
      title: 'Parity Project',
      now: '2026-10-02T10:00:00.000Z',
    })
    const body = JSON.stringify({ project })

    const direct = await dispatchClassGraphApi({
      method: 'POST',
      path: '/api/analysis/project',
      body,
    })

    const base = await startServer()
    const http = await fetch(`${base}/api/analysis/project`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    })

    expect(direct.status).toBe(200)
    expect(http.status).toBe(200)
    expect(typeof direct.body).toBe('string')
    expect(await http.json()).toEqual(JSON.parse(direct.body as string))
  })

  it('reports desktop IPC mode without requiring any network listener', async () => {
    const response = await dispatchClassGraphApi(
      { method: 'GET', path: '/api/desktop/status' },
      { desktop: true },
    )

    expect(response.status).toBe(200)
    expect(JSON.parse(response.body as string)).toEqual({ desktop: true })
  })
})
