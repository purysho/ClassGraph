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

async function startServer(
  maxBodyBytes?: number,
  appDirectory = 'does-not-matter-for-api-tests',
): Promise<string> {
  const server = createClassGraphServer({
    appDirectory,
    maxBodyBytes,
  })
  servers.push(server)
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address() as AddressInfo
  return `http://127.0.0.1:${address.port}`
}

describe('local app server', () => {
  it('serves the local teacher workspace shell without remote assets', async () => {
    const base = await startServer(undefined, 'app')
    const response = await fetch(base)

    expect(response.status).toBe(200)
    const html = await response.text()
    expect(html).toContain('<div id="app"></div>')
    expect(html).toContain('src="/app.js"')
    expect(html).toContain('href="/styles.css"')
    expect(html).not.toMatch(/https?:\/\//)
  })

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
    expect(body.project.students).toEqual([
      { id: 's-001', displayName: 'Student One', metrics: {} },
    ])
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

  it('generates the same synthetic student data from the same structured specification', async () => {
    const base = await startServer()
    const specification = {
      projectId: 'structured-synthetic',
      title: 'Structured Synthetic',
      studentCount: 12,
      seed: 'repeatable-seed',
      metricDefinitions: [
        {
          key: 'score',
          label: 'Score',
          kind: 'number',
          numberScale: { min: 0, max: 100 },
        },
        {
          key: 'participation',
          label: 'Participation',
          kind: 'ordinal',
          ordinalScale: ['1', '2', '3', '4', '5'],
        },
      ],
      metrics: [
        {
          key: 'score',
          kind: 'number',
          distribution: {
            type: 'normal',
            mean: 68,
            standardDeviation: 11,
            min: 0,
            max: 100,
          },
          missingRate: 0.1,
        },
        {
          key: 'participation',
          kind: 'ordinal',
          values: [
            { value: '1', weight: 1 },
            { value: '2', weight: 2 },
            { value: '3', weight: 4 },
            { value: '4', weight: 2 },
            { value: '5', weight: 1 },
          ],
          missingRate: 0.05,
        },
      ],
    }

    const generate = async () => {
      const response = await fetch(`${base}/api/synthetic/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(specification),
      })
      expect(response.status).toBe(200)
      return (await response.json()) as {
        project: {
          students: unknown[]
          provenance: Record<string, { kind: string }>
        }
      }
    }

    const first = await generate()
    const second = await generate()

    expect(first.project.students).toHaveLength(12)
    expect(first.project.students).toEqual(second.project.students)
    expect(first.project.provenance['/students/0/metrics/score']?.kind).toBe('synthetic')
  })

  it('generates deterministic seating candidates through the local planning API', async () => {
    const base = await startServer()
    let project = createEmptyProject({
      projectId: 'planning-api',
      title: 'Planning API',
      now: '2026-10-01T10:00:00.000Z',
    })

    const mutate = async (command: Record<string, unknown>) => {
      const response = await fetch(`${base}/api/project/mutate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project, command }),
      })
      expect(response.status).toBe(200)
      const body = (await response.json()) as { project: typeof project }
      project = body.project
    }

    for (const id of ['s1', 's2', 's3', 's4']) {
      await mutate({ type: 'add-student', student: { id } })
    }
    await mutate({ type: 'set-grid-room', rows: 2, columns: 2, front: 'top' })
    await mutate({
      type: 'add-planning-rule',
      rule: {
        id: 'apart',
        strength: 'hard',
        kind: 'keep-apart',
        studentAId: 's1',
        studentBId: 's2',
      },
    })

    const generate = async () => {
      const response = await fetch(`${base}/api/planning/seating`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project,
          seed: 'api-seat',
          candidateCount: 3,
          attempts: 300,
        }),
      })
      expect(response.status).toBe(200)
      return (await response.json()) as {
        result: {
          candidates: Array<{
            assignments: Array<{ studentId: string; seatId: string }>
            hardConstraintResults: Array<{ satisfied: boolean }>
          }>
        }
      }
    }

    const first = await generate()
    const second = await generate()
    expect(first).toEqual(second)
    expect(first.result.candidates).toHaveLength(3)
    expect(
      first.result.candidates.every((candidate) =>
        candidate.hardConstraintResults.every((result) => result.satisfied),
      ),
    ).toBe(true)
  })

  it('generates deterministic grouping candidates through the local planning API', async () => {
    const base = await startServer()
    let project = createEmptyProject({
      projectId: 'group-api',
      title: 'Group API',
      now: '2026-10-01T10:00:00.000Z',
    })

    const mutate = async (command: Record<string, unknown>) => {
      const response = await fetch(`${base}/api/project/mutate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project, command }),
      })
      expect(response.status).toBe(200)
      const body = (await response.json()) as { project: typeof project }
      project = body.project
    }

    for (const id of ['s1', 's2', 's3', 's4', 's5', 's6']) {
      await mutate({ type: 'add-student', student: { id } })
    }

    const response = await fetch(`${base}/api/planning/grouping`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        project,
        groupCount: 3,
        seed: 'api-groups',
        candidateCount: 3,
        attempts: 100,
      }),
    })
    expect(response.status).toBe(200)
    const body = (await response.json()) as {
      result: { candidates: Array<{ groups: Array<{ studentIds: string[] }> }> }
    }
    expect(body.result.candidates).toHaveLength(3)
    expect(body.result.candidates[0]?.groups.map((group) => group.studentIds.length)).toEqual([
      2, 2, 2,
    ])
  })

})
