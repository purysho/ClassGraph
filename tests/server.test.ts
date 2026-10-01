import { once } from 'node:events'
import type { AddressInfo } from 'node:net'
import { afterEach, describe, expect, it } from 'vitest'
import { serializeProjectJson } from '../src/json.js'
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

async function startServer(maxBodyBytes?: number): Promise<string> {
  const server = createClassGraphServer({
    appDirectory: 'does-not-matter-for-api-tests',
    maxBodyBytes,
  })
  servers.push(server)
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address() as AddressInfo
  return `http://127.0.0.1:${address.port}`
}

describe('local app server', () => {
  it('reports a local health response', async () => {
    const base = await startServer()
    const response = await fetch(`${base}/api/health`)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      service: 'ClassGraph',
      schemaVersion: '1.0',
    })
  })

  it('validates imported JSON through the ClassGraph schema', async () => {
    const base = await startServer()
    const project = createEmptyProject({
      projectId: 'class-5a',
      title: 'Grade 5A',
      now: '2026-10-01T10:00:00.000Z',
    })
    const response = await fetch(`${base}/api/import`, {
      method: 'POST',
      body: serializeProjectJson(project),
    })

    expect(response.status).toBe(200)
    const body = (await response.json()) as { project: { projectId: string } }
    expect(body.project.projectId).toBe('class-5a')
  })

  it('returns validated Exchange v1 JSON from the export endpoint', async () => {
    const base = await startServer()
    const project = createEmptyProject({
      projectId: 'class-5a',
      title: 'Grade 5A',
      now: '2026-10-01T10:00:00.000Z',
    })
    const response = await fetch(`${base}/api/export`, {
      method: 'POST',
      body: serializeProjectJson(project),
    })

    expect(response.status).toBe(200)
    expect(response.headers.get('content-disposition')).toContain('classgraph-project.json')
    const exported = JSON.parse(await response.text()) as { schemaVersion: string }
    expect(exported.schemaVersion).toBe('1.0')
  })

  it('rejects malformed ClassGraph JSON', async () => {
    const base = await startServer()
    const response = await fetch(`${base}/api/import`, {
      method: 'POST',
      body: '{"schemaVersion":"1.0"}',
    })

    expect(response.status).toBe(400)
    const body = (await response.json()) as { error: { code: string } }
    expect(body.error.code).toBe('CG-1001')
  })

  it('caps request bodies', async () => {
    const base = await startServer(20)
    const response = await fetch(`${base}/api/import`, {
      method: 'POST',
      body: 'x'.repeat(21),
    })

    expect(response.status).toBe(413)
  })
})
