import { useEffect, useState } from 'react'
import { RefreshCw, Clock, AlertTriangle, Loader, RotateCcw, Download } from 'lucide-react'
import client from '@/api/client'
import { useUIStore } from '@/store/uiStore'

interface AppInfo { version: string; build_date: string; latest_version?: string }
interface SyncJob { id: number; status: string; completed_at: string | null }
interface LogEntry { id: number }

const SEEN_VERSION_KEY = 'infra-panel-seen-version'

export function TopBar() {
  const [info, setInfo] = useState<AppInfo | null>(null)
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [checking, setChecking] = useState(false)
  const [lastSync, setLastSync] = useState<string | null>(null)
  const [runningJobs, setRunningJobs] = useState(0)
  const [errorCount, setErrorCount] = useState(0)
  const lastReload = useUIStore((s) => s.lastReload)
  const previewUser = useUIStore((s) => s.previewUser)
  const clearPreview = useUIStore((s) => s.clearPreview)

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

  const checkForUpdates = () => {
    setChecking(true)
    client.get<AppInfo>('/info').then(r => {
      setInfo(r.data)
      const seen = localStorage.getItem(SEEN_VERSION_KEY)
      if (r.data.latest_version && r.data.latest_version !== r.data.version) {
        setUpdateAvailable(true)
      } else if (seen && seen !== r.data.version) {
        setUpdateAvailable(true)
      }
      setChecking(false)
    }).catch(() => setChecking(false))
  }

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
    <>
      {/* Preview banner */}
      {previewUser && (
        <div className="bg-primary/20 border-b border-primary/30 px-4 py-1.5 flex items-center justify-between text-xs">
          <span className="text-primary font-medium">
            Vorschau als <strong>{previewUser.username}</strong> ({previewUser.role})
          </span>
          <button
            onClick={clearPreview}
            className="px-2 py-0.5 bg-primary text-primary-foreground rounded text-xs hover:opacity-90"
          >
            Beenden
          </button>
        </div>
      )}

      {/* Main TopBar */}
      <div className="relative flex items-center gap-4 px-4 py-2 bg-card border-b border-border flex-wrap">
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
            <button
              onClick={checkForUpdates}
              disabled={checking}
              title="Auf Updates prüfen"
              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
            >
              {checking ? <Loader size={11} className="animate-spin" /> : <RefreshCw size={11} />}
            </button>
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

        {/* Centered Reload display */}
        {lastReload && (
          <div className="absolute left-1/2 -translate-x-1/2">
            <span className="text-xs text-muted-foreground">
              Reload: {lastReload.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        )}

        <div className="ml-auto flex items-center gap-3">
          {!window.infraPanel && (
            <a
              href="https://github.com/jnwrld999/infra-panel/releases/latest"
              target="_blank"
              rel="noopener noreferrer"
              title="Desktop App herunterladen"
              className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <Download size={12} />
              Download
            </a>
          )}
          <button
            onClick={() => {
              if (window.infraPanel?.restart) {
                window.infraPanel.restart()
              } else {
                window.location.reload()
              }
            }}
            title="App neu starten"
            className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <RotateCcw size={12} />
            Neu starten
          </button>
        </div>
      </div>
    </>
  )
}
