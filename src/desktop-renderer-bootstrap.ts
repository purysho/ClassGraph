interface DesktopApiRequest {
  method: 'GET' | 'POST'
  path: string
  body?: string
}

interface DesktopApiResponse {
  status: number
  contentType: string
  filename?: string
  bodyText?: string
  bodyBase64?: string
}

interface ClassGraphDesktopBridge {
  request(request: DesktopApiRequest): Promise<DesktopApiResponse>
  saveProjectCopy(
    serializedProject: string,
    suggestedTitle: string,
  ): Promise<{ canceled: boolean; filePath?: string }>
}

declare global {
  interface Window {
    classGraphDesktop?: ClassGraphDesktopBridge
  }
}

function base64Bytes(value: string): Uint8Array {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

const desktop = window.classGraphDesktop

if (desktop) {
  const browserFetch = window.fetch.bind(window)

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const rawUrl =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url
    const url = new URL(rawUrl, window.location.href)

    if (!url.pathname.startsWith('/api/')) {
      return browserFetch(input, init)
    }

    const method = (init?.method?.toUpperCase() ?? 'GET') === 'POST' ? 'POST' : 'GET'
    const body = typeof init?.body === 'string' ? init.body : undefined
    const result = await desktop.request({ method, path: url.pathname, body })
    const headers = new Headers({ 'Content-Type': result.contentType })
    if (result.filename) {
      headers.set(
        'Content-Disposition',
        `attachment; filename*=UTF-8''${encodeURIComponent(result.filename)}`,
      )
    }

    const responseBody =
      result.bodyBase64 !== undefined
        ? base64Bytes(result.bodyBase64)
        : (result.bodyText ?? '')

    return new Response(responseBody, {
      status: result.status,
      headers,
    })
  }
}

export {}
