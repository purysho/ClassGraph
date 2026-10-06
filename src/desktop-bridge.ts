export interface DesktopApiRequest {
  method: 'GET' | 'POST'
  path: string
  body?: string
}

export interface DesktopApiResponse {
  status: number
  contentType: string
  filename?: string
  bodyText?: string
  bodyBase64?: string
}

export type DesktopUpdateAction =
  'status' | 'check' | 'download' | 'install' | 'open-releases' | 'get-settings' | 'set-settings'

export interface ClassGraphDesktopBridge {
  updates?(action: DesktopUpdateAction, payload?: unknown): Promise<unknown>
  request(request: DesktopApiRequest): Promise<DesktopApiResponse>
  saveProjectCopy(
    serializedProject: string,
    suggestedTitle: string,
    plain?: boolean,
  ): Promise<{ canceled: boolean; filePath?: string }>
}

declare global {
  interface Window {
    classGraphDesktop?: ClassGraphDesktopBridge
  }
}
