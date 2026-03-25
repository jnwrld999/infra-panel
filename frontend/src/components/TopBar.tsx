import { useEffect, useState } from 'react'
import { RefreshCw, Clock, AlertTriangle, Loader, Circle, RotateCcw } from 'lucide-react'
import client from '@/api/client'

interface AppInfo { version: string; build_date: string }
interface SyncJob { id: number; status: string; completed_at: string | null }
interface LogEntry { id: number }

const SEEN_VERSION_KEY = 'infra-panel-seen-version'

export function TopBar() {
  const [info, setInfo] = useState<AppInfo | null>(null)
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [lastSync, setLastSync] = useState<string | null>(null)
  const [runningJobs, setRunningJobs] = useState(0)
  const [errorCount, setErrorCount] = useState(0)

  useEffect(() => {
    // Version check
    client.get<AppInfo>('/info').then((r) => {
      setInfo(r.data)
      const seen = localStorage.getItem(SEEN_VERSION_KEY)
      if (seen && seen !== r.data.version) setUpdateAvailable(true)
      if (!seen) localStorage.setItem(SEEN_VERSION_KEY, r.data.version)
    }).catch(() => {})

    // Sync jobs
    client.get<SyncJob[]>('/sync/').then((r) => {
      const jobs = r.data
      const running = jobs.filter((j) => j.status === 'running').length
      setRunningJobs(running)
      const completed = jobs
        .filter((j) => j.completed_at)
        .sort((a, b) => new Date(b.completed_at!).getTime() - new Date(a.completed_at!).getTime())
      if (completed.length > 0) setLastSync(completed[0].completed_at)
    }).catch(() => {})

    // Error count (use limit=50 to count, logs API returns list)
    client.get<LogEntry[]>('/logs/?level=ERROR&days=1&limit=50').then((r) => {
      setErrorCount(r.data.length)
    }).catch(() => {})
  }, [])

  const formatSync = (ts: string) => {
    const d = new Date(ts)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    if (diffMins < 1) return 'gerade eben'
    if (diffMins < 60) return `vor ${diffMins}m`
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `vor ${diffHours}h`
    return d.toLocaleDateString('de-DE')
  }

  return (
    <div className="flex items-center gap-4 px-4 py-2 bg-card border-b border-border flex-wrap">
      {/* Version */}
      {info && (
        <div className="flex items-center gap-1.5 text-xs">
          {updateAvailable ? (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 font-medium">
              <RefreshCw size={11} />
              Update verfügbar — v{info.version}
            </span>
          ) : (
            <span className="text-muted-foreground font-mono">v{info.version}</span>
          )}
        </div>
      )}

      <div className="w-px h-3 bg-border flex-shrink-0" />

      {/* Last sync */}
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Clock size={12} />
        <span>Sync: {lastSync ? formatSync(lastSync) : '—'}</span>
      </div>

      <div className="w-px h-3 bg-border flex-shrink-0" />

      {/* Errors */}
      <div className={`flex items-center gap-1.5 text-xs ${errorCount > 0 ? 'text-red-400' : 'text-muted-foreground'}`}>
        <AlertTriangle size={12} />
        <span>{errorCount} Fehler (24h)</span>
      </div>

      {/* Running jobs */}
      {runningJobs > 0 && (
        <>
          <div className="w-px h-3 bg-border flex-shrink-0" />
          <div className="flex items-center gap-1.5 text-xs text-yellow-400">
            <Loader size={12} className="animate-spin" />
            <span>{runningJobs} Job{runningJobs > 1 ? 's' : ''} laufen</span>
          </div>
        </>
      )}

      <div className="ml-auto flex items-center gap-3">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Circle size={8} className="fill-green-400 text-green-400" />
          <span>Discord</span>
        </div>
        <div className="w-px h-3 bg-border flex-shrink-0" />
        <button
          onClick={() => window.location.reload()}
          title="App neu starten"
          className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <RotateCcw size={12} />
          Neu starten
        </button>
      </div>
    </div>
  )
}
