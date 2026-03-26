import { useEffect, useState } from 'react'
import { StatusBadge } from '@/components/StatusBadge'
import client from '@/api/client'
import { Info, ChevronDown, Plus } from 'lucide-react'

interface SyncJob {
  id: number
  server_id: number
  source_path: string
  dest_path: string
  last_run: string | null
  last_status: string | null
}

export default function Sync() {
  const [jobs, setJobs] = useState<SyncJob[]>([])
  const [results, setResults] = useState<Record<number, string>>({})
  const [running, setRunning] = useState<Record<number, boolean>>({})
  const [helpOpen, setHelpOpen] = useState(false)

  const [createModal, setCreateModal] = useState(false)
  const [createForm, setCreateForm] = useState({ server_id: '', source_path: '', dest_path: '' })
  const [createLoading, setCreateLoading] = useState(false)
  const [createError, setCreateError] = useState('')
  const [servers, setServers] = useState<{ id: number; name: string }[]>([])

  useEffect(() => {
    client.get('/sync/').then((r) => setJobs(r.data)).catch(() => {})
  }, [])

  useEffect(() => {
    client.get<{ id: number; name: string }[]>('/servers').then(r => setServers(r.data)).catch(() => {})
  }, [])

  const runSync = (id: number, dry: boolean) => {
    setRunning(prev => ({ ...prev, [id]: true }))
    client.post(`/sync/${id}/run`, { dry_run: dry })
      .then(r => {
        const output = r.data.output ?? r.data.message ?? 'Sync gestartet (Hintergrund)'
        setResults(prev => ({ ...prev, [id]: output }))
      })
      .catch(e => setResults(prev => ({ ...prev, [id]: e?.response?.data?.detail || 'Fehler beim Sync.' })))
      .finally(() => setRunning(prev => ({ ...prev, [id]: false })))
  }

  const submitCreate = () => {
    if (!createForm.server_id || !createForm.source_path.trim() || !createForm.dest_path.trim()) {
      setCreateError('Alle Felder sind erforderlich.')
      return
    }
    setCreateLoading(true)
    setCreateError('')
    client.post('/sync/', {
      server_id: Number(createForm.server_id),
      source_path: createForm.source_path.trim(),
      dest_path: createForm.dest_path.trim(),
    })
      .then(r => {
        setJobs(prev => [...prev, r.data])
        setCreateModal(false)
        setCreateForm({ server_id: '', source_path: '', dest_path: '' })
      })
      .catch(e => setCreateError(e?.response?.data?.detail || 'Fehler beim Erstellen.'))
      .finally(() => setCreateLoading(false))
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-foreground">Synchronisation</h2>
        <button
          onClick={() => setCreateModal(true)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm hover:bg-primary/90 transition-colors"
        >
          <Plus size={14} />
          Sync-Job erstellen
        </button>
      </div>

      {/* Sync explanation */}
      <div className="mb-6 bg-blue-500/10 border border-blue-500/20 rounded-xl overflow-hidden">
        <button
          onClick={() => setHelpOpen(v => !v)}
          className="w-full flex items-center justify-between px-5 py-3 text-sm font-medium text-blue-400 hover:bg-blue-500/5 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Info size={14} />
            Was macht Sync?
          </div>
          <ChevronDown size={14} className={`transition-transform duration-200 ${helpOpen ? 'rotate-180' : ''}`} />
        </button>
        {helpOpen && (
          <div className="px-5 pb-5 text-sm space-y-3 border-t border-blue-500/20">
            <div className="pt-3">
              <p className="font-medium text-foreground mb-1">Was wird synchronisiert?</p>
              <p className="text-muted-foreground text-xs">Server-Konfigurationen, Plugin-Listen, Bot-Status und Metadaten werden vom Server abgerufen und lokal gespeichert.</p>
            </div>
            <div>
              <p className="font-medium text-foreground mb-1">Richtung</p>
              <p className="text-muted-foreground text-xs">Sync ist Pull: Server → App. Push (App → Server) passiert nur bei expliziten Aktionen.</p>
            </div>
            <div>
              <p className="font-medium text-foreground mb-1">Risiken</p>
              <p className="text-muted-foreground text-xs">Niemals während laufendem Minecraft-Neustart synchronisieren. Ein fehlerhafter Sync kann veraltete Daten anzeigen.</p>
            </div>
            <div>
              <p className="font-medium text-foreground mb-1">Empfohlene Update-Strategie</p>
              <ol className="text-muted-foreground text-xs space-y-1 list-decimal list-inside">
                <li>Erst Status prüfen / Dry-Run durchführen</li>
                <li>Server-Backup anlegen</li>
                <li>Gezielten Sync starten (nicht alles auf einmal)</li>
                <li>Logs prüfen, bevor weitergemacht wird</li>
              </ol>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-4">
        {jobs.map((job) => (
          <div key={job.id} className="bg-card border border-border rounded-lg p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono text-xs truncate">{job.source_path} → {job.dest_path}</span>
              <StatusBadge status={job.last_status ?? 'unknown'} />
            </div>
            <div className="text-muted-foreground text-xs mb-3">
              Letzter Lauf: {job.last_run ? new Date(job.last_run).toLocaleString() : 'Nie'}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => runSync(job.id, true)}
                disabled={running[job.id]}
                className="px-3 py-1.5 text-sm bg-muted border border-border rounded-md text-foreground hover:bg-border transition-colors disabled:opacity-50"
              >
                {running[job.id] ? '...' : 'Dry-Run'}
              </button>
              <button
                onClick={() => runSync(job.id, false)}
                disabled={running[job.id]}
                className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:opacity-90 disabled:opacity-50"
              >
                {running[job.id] ? '...' : 'Sync'}
              </button>
            </div>
            {results[job.id] && (
              <pre className="mt-3 text-xs p-3 rounded-md font-mono whitespace-pre-wrap bg-muted/40 text-foreground">
                {results[job.id]}
              </pre>
            )}
          </div>
        ))}
        {jobs.length === 0 && <p className="text-muted-foreground">Keine Sync-Jobs konfiguriert.</p>}
      </div>

      {/* Create Sync Job modal */}
      {createModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card border border-border rounded-lg p-6 w-full max-w-md shadow-xl">
            <h3 className="text-base font-semibold mb-4">Sync-Job erstellen</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Server</label>
                <select
                  value={createForm.server_id}
                  onChange={e => setCreateForm(prev => ({ ...prev, server_id: e.target.value }))}
                  className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">Server wählen...</option>
                  {servers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Quellpfad</label>
                <input
                  type="text"
                  value={createForm.source_path}
                  onChange={e => setCreateForm(prev => ({ ...prev, source_path: e.target.value }))}
                  placeholder="/opt/minecraft/plugins"
                  className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Zielpfad</label>
                <input
                  type="text"
                  value={createForm.dest_path}
                  onChange={e => setCreateForm(prev => ({ ...prev, dest_path: e.target.value }))}
                  placeholder="/home/juice/backups/plugins"
                  className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              {createError && <p className="text-sm text-destructive">{createError}</p>}
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => { setCreateModal(false); setCreateError('') }}
                className="px-4 py-2 rounded-md border border-border text-sm hover:bg-muted transition-colors"
              >
                Abbrechen
              </button>
              <button
                onClick={submitCreate}
                disabled={createLoading}
                className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {createLoading ? 'Erstelle...' : 'Erstellen'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
