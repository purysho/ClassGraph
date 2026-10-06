import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('classGraphDesktop', {
  request: (request: unknown) => ipcRenderer.invoke('classgraph:request', request),
  updates: (action: string, payload?: unknown) =>
    ipcRenderer.invoke('classgraph:updates', action, payload),
  saveProjectCopy: (serializedProject: string, suggestedTitle: string, plain?: boolean) =>
    ipcRenderer.invoke('classgraph:save-project-copy', serializedProject, suggestedTitle, plain),
})
