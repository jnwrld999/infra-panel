import { contextBridge } from 'electron'

contextBridge.exposeInMainWorld('infraPanel', { version: '1.0.0', platform: process.platform })
