import { once } from 'node:events'
import { mkdtemp } from 'node:fs/promises'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { FileProjectStore } from '../src/project-store.js'
import { createClassGraphServer } from '../src/server.js'
import { createEmptyProject } from '../src/workspace.js'
import { serializeProjectJson } from '../src/json.js'

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

async function startPersistentServer(): Promise<{
  base: string
  store: FileProjectStore
  directory: string
}> {
  const directory = await mkdtemp(join(tmpdir(), 'classgraph-server-store-'))
  const store = new FileProjectStore(directory)
  const server = createClassGraphServer({
    appDirectory: 'does-not-matter-for-api-tests',
    projectStore: store,
  })
  servers.push(server)
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address() as AddressInfo
  return { base: \`http://127.0.0.1:\${address.port}\`, store, directory }
}

async function jsonPost(base: string, path: string, body: unknown): Promise<Response> {
  return fetch(\`\${base}\${path}\`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('persistent local app API', () => {
  it('autosaves manual creation and accepted mutations', async () => {
    const { base, directory } = await startPersistentServer()

    const createdResponse = await jsonPost(base, '/api/project/create', {
      projectId: 'manual-5a',
      title: 'Grade 5A English',
      classInfo: { subject: 'English', gradeOrLevel: 'Grade 5' },
    })
    expect(createdResponse.status).toBe(200)
    const created = (await createdResponse.json()) as { project: unknown }

    const mutationResponse = await jsonPost(base, '/api/project/mutate', {
      project: created.project,
      command: {
        type: 'add-student',
        student: { id: 's-001', displayName: 'Student One' },
      },
    })
    expect(mutationResponse.status).toBe(200)

    const restarted = new FileProjectStore(directory)
    await expect(restarted.load('manual-5a')).resolves.toMatchObject({
      projectId: 'manual-5a',
      students: [{ id: 's-001', displayName: 'Student One' }],
    })
  })

  it('imports a portable backup into the local project library', async () => {
    const { base, directory } = await startPersistentServer()
    const project = createEmptyProject({
      projectId: 'restored-class',
      title: 'Restored Class',
      now: '2026-10-02T10:00:00.000Z',
    })

    const response = await fetch(\`\${base}/api/import\`, {
      method: 'POST',
      body: serializeProjectJson(project),
    })
    expect(response.status).toBe(200)

    const restarted = new FileProjectStore(directory)
    await expect(restarted.load('restored-class')).resolves.toMatchObject({
      title: 'Restored Class',
    })
  })

  it('autosaves generated synthetic projects', async () => {
    const { base, directory } = await startPersistentServer()
    const response = await jsonPost(base, '/api/synthetic/generate', {
      projectId: 'synthetic-saved',
      title: 'Synthetic Saved',
      studentCount: 8,
      seed: 'saved-seed',
      metricDefinitions: [
        {
          key: 'score',
          label: 'Score',
          kind: 'number',
          numberScale: { min: 0, max: 100 },
        },
      ],
      metrics: [
        {
          key: 'score',
          kind: 'number',
          distribution: {
            type: 'normal',
            mean: 70,
            standardDeviation: 10,
            min: 0,
            max: 100,
          },
          missingRate: 0,
        },
      ],
    })
    expect(response.status).toBe(200)

    const restarted = new FileProjectStore(directory)
    const saved = await restarted.load('synthetic-saved')
    expect(saved.students).toHaveLength(8)
    expect(saved.provenance['/students/0/metrics/score']?.kind).toBe('synthetic')
  })

  it('lists and reopens saved projects through the local API', async () => {
    const { base } = await startPersistentServer()

    const createdResponse = await jsonPost(base, '/api/project/create', {
      projectId: 'recent-class',
      title: 'Recent Class',
    })
    expect(createdResponse.status).toBe(200)

    const listResponse = await fetch(\`\${base}/api/projects\`)
    expect(listResponse.status).toBe(200)
    const library = (await listResponse.json()) as {
      enabled: boolean
      lastProjectId: string | null
      projects: Array<{ projectId: string; title: string }>
    }
    expect(library.enabled).toBe(true)
    expect(library.lastProjectId).toBe('recent-class')
    expect(library.projects).toEqual([
      expect.objectContaining({ projectId: 'recent-class', title: 'Recent Class' }),
    ])

    const openResponse = await jsonPost(base, '/api/projects/open', {
      projectId: 'recent-class',
    })
    expect(openResponse.status).toBe(200)
    await expect(openResponse.json()).resolves.toMatchObject({
      project: { projectId: 'recent-class', title: 'Recent Class' },
    })
  })

  it('rejects malformed backup JSON without creating a saved project', async () => {
    const { base, store } = await startPersistentServer()

    const response = await fetch(\`\${base}/api/import\`, {
      method: 'POST',
      body: '{"schemaVersion":"1.0"}',
    })
    expect(response.status).toBe(400)

    const library = await store.list()
    expect(library.projects).toEqual([])
  })
})
