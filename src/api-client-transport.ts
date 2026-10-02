import type { ClassGraphDesktopBridge } from './desktop-bridge.js'

export interface ApiClientEnvironment {
  desktopBridge?: ClassGraphDesktopBridge
  browserFetch: typeof fetch
  protocol: string
}

function defaultEnvironment(): ApiClientEnvironment {
  return {
    desktopBridge: window.classGraphDesktop,
    browserFetch: window.fetch.bind(window),
    protocol: window.location.protocol,
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

function desktopResponseBody(result: { bodyText?: string; bodyBase64?: string }): BodyInit {
  if (result.bodyBase64 === undefined) return result.bodyText ?? ''

  const bytes = base64Bytes(result.bodyBase64)
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
}

function normalizedApiPath(path: string): string {
  return new URL(path, 'https://classgraph.local').pathname
}

export async function classGraphApiFetch(
  path: string,
  init?: RequestInit,
  environment: ApiClientEnvironment = defaultEnvironment(),
): Promise<Response> {
  const apiPath = normalizedApiPath(path)

  if (!apiPath.startsWith('/api/')) {
    return environment.browserFetch(path, init)
  }

  if (environment.desktopBridge) {
    const method = (init?.method?.toUpperCase() ?? 'GET') === 'POST' ? 'POST' : 'GET'
    if (init?.body !== undefined && typeof init.body !== 'string') {
      throw new Error('CG-2015 desktop API request bodies must be text')
    }

    const result = await environment.desktopBridge.request({
      method,
      path: apiPath,
      ...(typeof init?.body === 'string' ? { body: init.body } : {}),
    })

    const headers = new Headers({ 'Content-Type': result.contentType })
    if (result.filename) {
      headers.set(
        'Content-Disposition',
        `attachment; filename*=UTF-8''${encodeURIComponent(result.filename)}`,
      )
    }

    return new Response(desktopResponseBody(result), {
      status: result.status,
      headers,
    })
  }

  if (environment.protocol === 'file:') {
    throw new Error(
      'CG-2014 ClassGraph desktop bridge did not load. Close ClassGraph completely and reopen it.',
    )
  }

  return environment.browserFetch(path, init)
}
