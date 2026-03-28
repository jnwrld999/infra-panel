import { useEffect, useState, useCallback } from 'react'
import { AlertTriangle, RefreshCw, Loader, Trash2 } from 'lucide-react'
import client from '@/api/client'
import { useUIStore } from '@/store/uiStore'
import { getDevLogs, clearDevLogs, type DevLogEntry } from '@/lib/devLog'

type LogCategory = 'system' | 'error' | 'audit' | 'dev'

const CATEGORIES: { key: LogCategory; label: string; dotClass: string; textClass: string }[] = [
  { key: 'system', label: 'System',  dotClass: 'bg-muted-foreground', textClass: 'text-muted-foreground' },
  { key: 'error',  label: 'Fehler',  dotClass: 'bg-red-400',          textClass: 'text-red-400' },
  { key: 'audit',  label: 'Audit',   dotClass: 'bg-purple-400',       textClass: 'text-purple-400' },
  { key: 'dev',    label: 'Dev',     dotClass: 'bg-yellow-400',       textClass: 'text-yellow-400' },
]

interface LogEntry {
  id: number
  level: string
  message: string
  created_at: string
  category?: string
  source?: string
}

export default function Logs() {
  const { devMode } = useUIStore()
  const [category, setCategory] = useState<LogCategory>('system')
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [devLogs, setDevLogs] = useState<DevLogEntry[]>([])
  const [loading, setLoading] = useState(false)

  const loadLogs = useCallback(() => {
    if (category === 'dev') {
      setDevLogs(getDevLogs().reverse())
      return
    }
    setLoading(true)
    setLogs([])
    const params: Record<string, string> = { limit: '100' }
    if (category === 'error') params.level = 'ERROR'
    else if (category === 'system') params.level = 'INFO'
    else if (category === 'audit') params.category = 'audit'

    const query = new URLSearchParams(params).toString()
    client.get<LogEntry[]>(`/logs/?${query}`).then(r => {
      setLogs(r.data)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [category])

  useEffect(() => { loadLogs() }, [loadLogs])

  const cat = CATEGORIES.find(c => c.key === category)!

  return (
    <div className="flex gap-6">
      {/* Left nav */}
      <nav className="w-40 flex-shrink-0 space-y-1">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-2 mb-2">Kategorie</p>
        {CATEGORIES.map(c => (
          <button key={c.key} onClick={() => setCategory(c.key)}
            className={`w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
              category === c.key ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${c.dotClass}`} />
            {c.label}
            {c.key === 'dev' && !devMode && (
              <span className="ml-auto text-xs text-muted-foreground">off</span>
            )}
          </button>
        ))}
      </nav>

      {/* Main */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-foreground">
            Logs — <span className={cat.textClass}>{cat.label}</span>
          </h2>
          <div className="flex items-center gap-2">
            {category === 'dev' && devMode && (
              <button onClick={() => { clearDevLogs(); setDevLogs([]) }}
                className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs text-red-400 hover:bg-red-500/10 border border-red-500/20 transition-colors">
                <Trash2 size={12} /> Leeren
              </button>
            )}
            <button onClick={loadLogs} disabled={loading}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50">
              {loading ? <Loader size={13} className="animate-spin" /> : <RefreshCw size={13} />}
              Aktualisieren
            </button>
          </div>
        </div>

        {category === 'dev' && !devMode && (
          <div className="flex items-center gap-2 text-sm text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-5 py-4">
            <AlertTriangle size={14} />
            Dev-Modus ist deaktiviert. In den Einstellungen aktivieren.
          </div>
        )}

        {category === 'dev' && devMode && (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            {devLogs.length === 0 ? (
              <div className="px-5 py-10 text-center text-sm text-muted-foreground">Keine Dev-Logs — interagiere mit der App</div>
            ) : (
              <div className="divide-y divide-border">
                {devLogs.map((e) => (
                  <div key={e.t} className="px-4 py-2 flex items-start gap-3 hover:bg-muted/20 transition-colors">
                    <span className="text-xs font-mono text-muted-foreground flex-shrink-0 pt-0.5">{e.t.slice(11, 23)}</span>
                    <div className="min-w-0">
                      <p className="text-sm text-yellow-400">{e.action}</p>
                      {e.detail && <p className="text-xs text-muted-foreground truncate">{e.detail}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {category !== 'dev' && (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            {loading ? (
              <div className="px-5 py-10 text-center text-sm text-muted-foreground">
                <Loader size={16} className="animate-spin inline mr-2" />Lädt…
              </div>
            ) : logs.length === 0 ? (
              <div className="px-5 py-10 text-center text-sm text-muted-foreground">Keine Logs</div>
            ) : (
              <div className="divide-y divide-border">
                {logs.map(log => (
                  <div key={log.id} className="px-4 py-2.5 flex items-start gap-3 hover:bg-muted/20 transition-colors">
                    <span className="text-xs font-mono text-muted-foreground flex-shrink-0 pt-0.5">
                      {log.created_at ? new Date(log.created_at).toLocaleTimeString('de-DE') : '—'}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm ${log.level === 'ERROR' ? 'text-red-400' : 'text-foreground'}`}>{log.message}</p>
                      {log.source && <p className="text-xs text-muted-foreground">{log.source}</p>}
                    </div>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                      log.level === 'ERROR' ? 'bg-red-500/15 text-red-400' :
                      log.level === 'WARN' ? 'bg-yellow-500/15 text-yellow-400' :
                      'bg-muted text-muted-foreground'
                    }`}>{log.level}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
