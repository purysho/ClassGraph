import { describe, expect, it, vi } from 'vitest'
import { classGraphApiFetch } from '../src/api-client-transport.js'
import type { ClassGraphDesktopBridge } from '../src/desktop-bridge.js'

function fakeBrowserFetch() {
  return vi.fn(async () => new Response('browser', { status: 200 })) as unknown as typeof fetch
}

describe('ClassGraph renderer API transport', () => {
  it('sends create-class requests through the Electron bridge in file mode', async () => {
    const requests: unknown[] = []
    const bridge: ClassGraphDesktopBridge = {
      request: async (request) => {
        requests.push(request)
        return {
          status: 200,
          contentType: 'application/json; charset=utf-8',
          bodyText: JSON.stringify({
            project: { projectId: 'grade-5a', title: 'Grade 5A English' },
          }),
        }
      },
      saveProjectCopy: async () => ({ canceled: true }),
    }
    const browserFetch = fakeBrowserFetch()

    const response = await classGraphApiFetch(
      '/api/project/create',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: 'grade-5a', title: 'Grade 5A English' }),
      },
      { desktopBridge: bridge, browserFetch, protocol: 'file:' },
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      project: { projectId: 'grade-5a', title: 'Grade 5A English' },
    })
    expect(requests).toEqual([
      {
        method: 'POST',
        path: '/api/project/create',
        body: JSON.stringify({ projectId: 'grade-5a', title: 'Grade 5A English' }),
      },
    ])
    expect(browserFetch).not.toHaveBeenCalled()
  })

  it('never falls through to browser fetch for API calls from file mode', async () => {
    const browserFetch = fakeBrowserFetch()

    await expect(
      classGraphApiFetch(
        '/api/project/create',
        { method: 'POST', body: '{}' },
        {
          browserFetch,
          protocol: 'file:',
        },
      ),
    ).rejects.toThrow('CG-2014')

    expect(browserFetch).not.toHaveBeenCalled()
  })

  it('keeps source development mode on normal HTTP fetch', async () => {
    const browserFetch = fakeBrowserFetch()

    const response = await classGraphApiFetch('/api/health', undefined, {
      browserFetch,
      protocol: 'http:',
    })

    expect(await response.text()).toBe('browser')
    expect(browserFetch).toHaveBeenCalledWith('/api/health', undefined)
  })

  it('preserves binary desktop responses for local report downloads', async () => {
    const bridge: ClassGraphDesktopBridge = {
      request: async () => ({
        status: 200,
        contentType: 'application/pdf',
        filename: 'report.pdf',
        bodyBase64: 'AQID',
      }),
      saveProjectCopy: async () => ({ canceled: true }),
    }

    const response = await classGraphApiFetch(
      '/api/export/pdf',
      { method: 'POST', body: '{}' },
      { desktopBridge: bridge, browserFetch: fakeBrowserFetch(), protocol: 'file:' },
    )

    expect(response.headers.get('content-disposition')).toContain('report.pdf')
    expect([...new Uint8Array(await response.arrayBuffer())]).toEqual([1, 2, 3])
  })
})
