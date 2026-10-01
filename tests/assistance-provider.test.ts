import { describe, expect, it } from 'vitest'
import {
  buildAssistanceRequest,
  runAssistance,
  assistanceServiceStatus,
} from '../src/assistance-service.js'
import {
  JsonHttpsAssistanceProvider,
  createEnvironmentAssistanceProvider,
  type AssistanceProvider,
} from '../src/assistance-provider.js'
import { serializeProjectJson } from '../src/json.js'
import { createEmptyProject } from '../src/workspace.js'

describe('assistance context and provider boundary', () => {
  it('uses aggregate/redacted context for analysis and report tasks', () => {
    const project = createEmptyProject({
      projectId: 'privacy',
      title: 'Privacy class',
      now: '2026-10-02T01:00:00.000Z',
    })
    project.students = [{ id: 's1', displayName: 'Private Name', metrics: {} }]

    const analysis = buildAssistanceRequest({
      project,
      task: 'analysis-explanation',
      mode: 'offline',
      requestId: 'aggregate-analysis',
    })
    expect(analysis.disclosure.containsStudentLevelData).toBe(false)
    expect(JSON.stringify(analysis.payload)).not.toContain('Private Name')
    expect(JSON.stringify(analysis.payload)).not.toContain('"s1"')

    const report = buildAssistanceRequest({
      project,
      task: 'report-wording-draft',
      mode: 'offline',
      requestId: 'redacted-report',
    })
    expect(report.disclosure.containsStudentLevelData).toBe(false)
    expect(report.disclosure.containsDisplayNames).toBe(false)
    expect(JSON.stringify(report.payload)).not.toContain('Private Name')
    expect(JSON.stringify(report.payload)).not.toContain('"s1"')
  })

  it('makes student-ID disclosure visible when planning suggestions require explicit relationship records', () => {
    const project = createEmptyProject({
      projectId: 'planning',
      title: 'Planning class',
      now: '2026-10-02T01:00:00.000Z',
    })
    project.students = [
      { id: 's1', metrics: {} },
      { id: 's2', metrics: {} },
    ]
    project.relationships = [
      {
        id: 'r1',
        fromStudentId: 's1',
        toStudentId: 's2',
        type: 'avoid-pairing',
      },
    ]

    const provider: AssistanceProvider = {
      label: 'Fake provider',
      mode: 'network',
      status: () => ({ enabled: true, mode: 'network', label: 'Fake provider' }),
      execute: () => Promise.reject(new Error('not called')),
    }
    const request = buildAssistanceRequest(
      {
        project,
        task: 'planning-rule-suggestions',
        mode: 'network',
        requestId: 'planning-preview',
      },
      provider,
    )

    expect(request.disclosure.containsStudentLevelData).toBe(true)
    expect(request.disclosure.containsRealStudentData).toBe(true)
    expect(request.disclosure.containsStudentIds).toBe(true)
    expect(request.disclosure.containsDisplayNames).toBe(false)
    expect(request.disclosure.requiresExplicitSend).toBe(true)
  })

  it('keeps network assistance disabled when provider environment settings are absent', () => {
    const provider = createEnvironmentAssistanceProvider({})
    expect(provider).toBeUndefined()
    expect(assistanceServiceStatus(provider)).toEqual({
      offlineAvailable: true,
      network: { enabled: false, mode: 'network' },
    })
  })

  it('does not expose provider credentials in status, requests, or project exports', () => {
    const token = 'private-provider-token'
    const provider = createEnvironmentAssistanceProvider({
      CLASSGRAPH_ASSISTANCE_URL: 'https://provider.example/assist',
      CLASSGRAPH_ASSISTANCE_PROVIDER_LABEL: 'Example',
      CLASSGRAPH_ASSISTANCE_TOKEN: token,
    })
    expect(provider).toBeDefined()

    const project = createEmptyProject({
      projectId: 'credential-boundary',
      title: 'Credential Boundary',
      now: '2026-10-02T01:00:00.000Z',
    })
    project.students = [{ id: 'student-private-id', displayName: 'Private Name', metrics: {} }]

    const statusText = JSON.stringify(assistanceServiceStatus(provider))
    expect(statusText).not.toContain(token)

    const request = buildAssistanceRequest(
      {
        project,
        task: 'analysis-explanation',
        mode: 'network',
        requestId: 'credential-preview',
      },
      provider,
    )
    const requestText = JSON.stringify(request)
    expect(requestText).not.toContain(token)
    expect(requestText).not.toContain('Private Name')
    expect(requestText).not.toContain('student-private-id')

    const exportText = serializeProjectJson(project)
    expect(exportText).not.toContain(token)
    expect(exportText).not.toContain('CLASSGRAPH_ASSISTANCE')
    expect(exportText).not.toContain('provider.example')
  })

  it('rejects non-HTTPS provider endpoints', () => {
    expect(
      () =>
        new JsonHttpsAssistanceProvider({
          label: 'Unsafe',
          endpoint: 'http://provider.example/assist',
        }),
    ).toThrow('CG-6006')
  })

  it('requires a second explicit confirmation before a configured provider receives context', async () => {
    let callCount = 0
    const fetchImpl: typeof fetch = (_input, init) => {
      callCount += 1
      expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer secret-token')
      return Promise.resolve(
        new Response(
          JSON.stringify({
            version: '1.0',
            proposalId: 'network-proposal',
            requestId: 'network-1',
            task: 'analysis-explanation',
            status: 'proposal',
            providerLabel: 'Example',
            warnings: [],
            assumptions: [],
            text: 'Descriptive draft.',
            sourceMetricKeys: [],
            caveats: ['No causal claim.'],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
    }

    const provider = new JsonHttpsAssistanceProvider({
      label: 'Example',
      endpoint: 'https://provider.example/assist',
      token: 'secret-token',
      fetchImpl,
    })
    const project = createEmptyProject({
      projectId: 'network',
      title: 'Network',
      now: '2026-10-02T01:00:00.000Z',
    })

    await expect(
      runAssistance(
        {
          project,
          task: 'analysis-explanation',
          mode: 'network',
          requestId: 'network-1',
          confirmSend: false,
        },
        provider,
      ),
    ).rejects.toThrow('CG-6007')
    expect(callCount).toBe(0)

    const result = await runAssistance(
      {
        project,
        task: 'analysis-explanation',
        mode: 'network',
        requestId: 'network-1',
        confirmSend: true,
      },
      provider,
    )
    expect(callCount).toBe(1)
    expect(result.proposal.status).toBe('proposal')
  })

  it('rejects oversized or mismatched provider output before it reaches the UI', async () => {
    const project = createEmptyProject({
      projectId: 'network',
      title: 'Network',
      now: '2026-10-02T01:00:00.000Z',
    })

    const mismatched = new JsonHttpsAssistanceProvider({
      label: 'Example',
      endpoint: 'https://provider.example/assist',
      fetchImpl: () =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              version: '1.0',
              proposalId: 'wrong',
              requestId: 'different',
              task: 'analysis-explanation',
              status: 'proposal',
              providerLabel: 'Example',
              warnings: [],
              assumptions: [],
              text: 'Wrong request.',
              sourceMetricKeys: [],
              caveats: [],
            }),
            { status: 200 },
          ),
        ),
    })

    await expect(
      runAssistance(
        {
          project,
          task: 'analysis-explanation',
          mode: 'network',
          requestId: 'expected',
          confirmSend: true,
        },
        mismatched,
      ),
    ).rejects.toThrow('CG-6008')

    const oversized = new JsonHttpsAssistanceProvider({
      label: 'Example',
      endpoint: 'https://provider.example/assist',
      maxResponseBytes: 10,
      fetchImpl: () => Promise.resolve(new Response('x'.repeat(20), { status: 200 })),
    })

    await expect(
      runAssistance(
        {
          project,
          task: 'analysis-explanation',
          mode: 'network',
          requestId: 'oversized',
          confirmSend: true,
        },
        oversized,
      ),
    ).rejects.toThrow('CG-6009')
  })
})
