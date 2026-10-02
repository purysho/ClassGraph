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

export interface ClassGraphDesktopBridge {
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
