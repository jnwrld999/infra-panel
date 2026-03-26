// frontend/src/lib/devLog.ts
import { useUIStore } from '@/store/uiStore'

export interface DevLogEntry {
  t: string
  action: string
  detail?: string
}

export function devLog(action: string, detail?: string) {
  if (!useUIStore.getState().devMode) return
  try {
    const entry: DevLogEntry = { t: new Date().toISOString(), action, detail }
    const existing: DevLogEntry[] = JSON.parse(sessionStorage.getItem('dev-logs') || '[]')
    existing.push(entry)
    sessionStorage.setItem('dev-logs', JSON.stringify(existing.slice(-200)))
  } catch {}
}

export function getDevLogs(): DevLogEntry[] {
  try {
    return JSON.parse(sessionStorage.getItem('dev-logs') || '[]')
  } catch {
    return []
  }
}

export function clearDevLogs() {
  sessionStorage.removeItem('dev-logs')
}
