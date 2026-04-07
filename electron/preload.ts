import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('infraPanel', {
  version: '0.4.0',
  platform: process.platform,
  restart: () => ipcRenderer.send('app:restart'),
})
