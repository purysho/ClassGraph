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

  it('creates a manual project through the local API', async () => {
    const base = await startServer()
    const response = await fetch(`${base}/api/project/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId: 'manual-5a',
        title: 'Grade 5A English',
        classInfo: { subject: 'English', gradeOrLevel: 'Grade 5' },
      }),
    })

    expect(response.status).toBe(200)
    const body = (await response.json()) as {
      project: { title: string; students: unknown[]; provenance: Record<string, { kind: string }> }
    }
    expect(body.project.title).toBe('Grade 5A English')
    expect(body.project.students).toEqual([])
    expect(body.project.provenance['/title']?.kind).toBe('teacher-entered')
  })

  it('creates a reproducible basic synthetic project through the local API', async () => {
    const base = await startServer()
    const request = {
      projectId: 'synthetic-36',
      title: 'Synthetic Class',
      studentCount: 36,
      seed: 'same-seed',
    }

    const first = await fetch(`${base}/api/synthetic/basic`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    })
    const second = await fetch(`${base}/api/synthetic/basic`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    })

    expect(first.status).toBe(200)
    expect(second.status).toBe(200)
    const firstBody = (await first.json()) as {
      project: { students: unknown[]; metricDefinitions: unknown[] }
    }
    const secondBody = (await second.json()) as {
      project: { students: unknown[]; metricDefinitions: unknown[] }
    }
    expect(firstBody.project.students).toHaveLength(36)
    expect(firstBody.project.metricDefinitions).toHaveLength(2)
    expect(firstBody.project.students).toEqual(secondBody.project.students)
  })


  it('applies a validated project mutation through the local API', async () => {
    const base = await startServer()
    const project = createEmptyProject({
      projectId: 'class-5a',
      title: 'Grade 5A',
      now: '2026-10-01T10:00:00.000Z',
    })
    const response = await fetch(`${base}/api/project/mutate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        project,
        command: {
          type: 'add-student',
          student: { id: 's-001', displayName: 'Student One' },
        },
      }),
    })

    expect(response.status).toBe(200)
    const body = (await response.json()) as {
      project: {
        students: Array<{ id: string; displayName?: string }>
        provenance: Record<string, { kind: string }>
      }
    }
    expect(body.project.students).toEqual([{ id: 's-001', displayName: 'Student One', metrics: {} }])
    expect(body.project.provenance['/students/0/displayName']?.kind).toBe('teacher-entered')
  })


  it('returns descriptive project analysis and scatter data', async () => {
    const base = await startServer()
    let project = createEmptyProject({
      projectId: 'analysis-api',
      title: 'Analysis API',
      now: '2026-10-01T10:00:00.000Z',
    })

    const createMutation = async (command: Record<string, unknown>) => {
      const response = await fetch(`${base}/api/project/mutate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project, command }),
      })
      expect(response.status).toBe(200)
      const body = (await response.json()) as { project: typeof project }
      project = body.project
    }

    await createMutation({ type: 'add-student', student: { id: 's1' } })
    await createMutation({ type: 'add-student', student: { id: 's2' } })
    await createMutation({
      type: 'add-metric-definition',
      definition: { key: 'x', label: 'X', kind: 'number' },
    })
    await createMutation({
      type: 'add-metric-definition',
      definition: { key: 'y', label: 'Y', kind: 'number' },
    })
    await createMutation({ type: 'set-metric-value', studentId: 's1', metricKey: 'x', value: 0 })
    await createMutation({ type: 'set-metric-value', studentId: 's1', metricKey: 'y', value: 2 })

    const analysisResponse = await fetch(`${base}/api/analysis/project`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project }),
    })
    expect(analysisResponse.status).toBe(200)
    const analysisBody = (await analysisResponse.json()) as {
      analysis: { completeness: { recordedCount: number; unrecordedCount: number } }
    }
    expect(analysisBody.analysis.completeness.recordedCount).toBe(2)
    expect(analysisBody.analysis.completeness.unrecordedCount).toBe(2)

    const scatterResponse = await fetch(`${base}/api/analysis/scatter`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project, xMetricKey: 'x', yMetricKey: 'y' }),
    })
    expect(scatterResponse.status).toBe(200)
    const scatterBody = (await scatterResponse.json()) as {
      scatter: { points: Array<{ studentId: string; x: number; y: number }>; omittedCount: number }
    }
    expect(scatterBody.scatter.points).toEqual([{ studentId: 's1', x: 0, y: 2 }])
    expect(scatterBody.scatter.omittedCount).toBe(1)
  })

})
