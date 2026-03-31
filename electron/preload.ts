import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('infraPanel', {
  version: '1.3.0',
  platform: process.platform,
  restart: () => ipcRenderer.send('app:restart'),
})
