import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('classGraphDesktop', {
  request: (request: unknown) => ipcRenderer.invoke('classgraph:request', request),
  saveProjectCopy: (serializedProject: string, suggestedTitle: string, plain?: boolean) =>
    ipcRenderer.invoke('classgraph:save-project-copy', serializedProject, suggestedTitle, plain),
})
