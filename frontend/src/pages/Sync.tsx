import { useEffect, useState } from 'react'
import { StatusBadge } from '@/components/StatusBadge'
import client from '@/api/client'

interface SyncJob {
  id: number
  name: string
  source: string
  destination: string
  last_run?: string
  status: string
}

interface SyncResult {
  output: string
  success: boolean
}

export default function Sync() {
  const [jobs, setJobs] = useState<SyncJob[]>([])
  const [results, setResults] = useState<Record<number, SyncResult>>({})
  const [running, setRunning] = useState<Record<number, boolean>>({})

  useEffect(() => {
    client.get('/sync/').then((r) => setJobs(r.data)).catch(() => {})
  }, [])

  const runSync = (id: number, dryRun: boolean) => {
    setRunning((prev) => ({ ...prev, [id]: true }))
    client.post(`/sync/${id}/run`, { dry_run: dryRun })
      .then((r) => setResults((prev) => ({ ...prev, [id]: { output: r.data.output ?? 'OK', success: true } })))
      .catch((e) => setResults((prev) => ({ ...prev, [id]: { output: e.response?.data?.detail ?? 'Fehler', success: false } })))
      .finally(() => setRunning((prev) => ({ ...prev, [id]: false })))
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-foreground mb-6">Synchronisation</h2>
      <div className="space-y-4">
        {jobs.map((job) => (
          <div key={job.id} className="bg-card border border-border rounded-lg p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-foreground text-lg">{job.name}</span>
              <StatusBadge status={job.status} />
            </div>
            <div className="text-muted-foreground text-sm mb-1">
              <span className="text-foreground">{job.source}</span>
              <span className="mx-2">→</span>
              <span className="text-foreground">{job.destination}</span>
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
              <pre className={`mt-3 text-xs p-3 rounded-md font-mono whitespace-pre-wrap ${results[job.id].success ? 'bg-green-900/30 text-green-300' : 'bg-red-900/30 text-red-300'}`}>
                {results[job.id].output}
              </pre>
            )}
          </div>
        ))}
        {jobs.length === 0 && <p className="text-muted-foreground">Keine Sync-Jobs konfiguriert.</p>}
      </div>
    </div>
  )
}
