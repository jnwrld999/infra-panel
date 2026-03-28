import { useEffect, useState } from 'react'
import { RefreshCw, Clock, AlertTriangle, Loader, RotateCcw, Download, ArrowUpCircle } from 'lucide-react'
import client from '@/api/client'
import { useUIStore } from '@/store/uiStore'

interface AppInfo { version: string; build_date: string; latest_version?: string }
interface LogEntry { id: number }

const GH_CACHE_KEY = 'infra-panel-gh-latest'
const GH_CACHE_TTL = 10 * 60 * 1000 // 10 minutes

async function fetchLatestGitHubVersion(): Promise<string | null> {
  try {
    const cached = localStorage.getItem(GH_CACHE_KEY)
    if (cached) {
      const { version, ts } = JSON.parse(cached)
      if (Date.now() - ts < GH_CACHE_TTL) return version
    }
    const res = await fetch('https://api.github.com/repos/jnwrld999/infra-panel/releases/latest')
    if (!res.ok) return null
    const data = await res.json()
    const version = (data.tag_name as string).replace(/^v/, '')
    localStorage.setItem(GH_CACHE_KEY, JSON.stringify({ version, ts: Date.now() }))
    return version
  } catch {
    return null
  }
}

function isNewerVersion(latest: string, current: string): boolean {
  const toNum = (v: string) => v.split('.').map(Number)
  const [lMaj, lMin, lPat] = toNum(latest)
  const [cMaj, cMin, cPat] = toNum(current)
  if (lMaj !== cMaj) return lMaj > cMaj
  if (lMin !== cMin) return lMin > cMin
  return lPat > cPat
}

export function TopBar() {
  const [info, setInfo] = useState<AppInfo | null>(null)
  const [latestVersion, setLatestVersion] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)
  const [errorCount, setErrorCount] = useState(0)
  const lastReload = useUIStore((s) => s.lastReload)
  const previewUser = useUIStore((s) => s.previewUser)
  const clearPreview = useUIStore((s) => s.clearPreview)

  useEffect(() => {
    client.get<AppInfo>('/info').then((r) => setInfo(r.data)).catch(() => {})
    client.get<LogEntry[]>('/logs/?level=ERROR&days=1&limit=50').then((r) => {
      setErrorCount(r.data.length)
    }).catch(() => {})
    fetchLatestGitHubVersion().then((v) => { if (v) setLatestVersion(v) })
  }, [])

  const checkForUpdates = () => {
    setChecking(true)
    localStorage.removeItem(GH_CACHE_KEY)
    fetchLatestGitHubVersion()
      .then((v) => { if (v) setLatestVersion(v) })
      .finally(() => setChecking(false))
  }

  const updateAvailable = !!(info && latestVersion && isNewerVersion(latestVersion, info.version))

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
              <a
                href="https://github.com/jnwrld999/infra-panel/releases/latest"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 font-medium hover:bg-blue-500/25 transition-colors"
                title={`v${latestVersion} herunterladen`}
              >
                <ArrowUpCircle size={11} />
                v{latestVersion} verfügbar
              </a>
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

        {/* Errors */}
        <div className={`flex items-center gap-1.5 text-xs ${errorCount > 0 ? 'text-red-400' : 'text-muted-foreground'}`}>
          <AlertTriangle size={12} />
          <span>{errorCount} Fehler (24h)</span>
        </div>

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
