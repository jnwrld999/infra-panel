import { useState } from 'react'
import client from '@/api/client'

interface LogEntry {
  id: number
  timestamp: string
  level: string
  category: string
  message: string
}

const LEVEL_COLORS: Record<string, string> = {
  ERROR: 'text-red-400',
  WARNING: 'text-yellow-400',
  INFO: 'text-blue-400',
  DEBUG: 'text-gray-400',
}

export default function Logs() {
  const [category, setCategory] = useState('')
  const [level, setLevel] = useState('')
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(false)

  const load = () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (category) params.set('category', category)
    if (level) params.set('level', level)
    params.set('limit', '100')
    client.get(`/logs/?${params}`)
      .then((r) => setLogs(r.data))
      .catch(() => setLogs([]))
      .finally(() => setLoading(false))
  }

  const exportUrl = `/api/logs/export?${new URLSearchParams({ ...(category ? { category } : {}), ...(level ? { level } : {}) })}`

  return (
    <div>
      <h2 className="text-2xl font-bold text-foreground mb-6">Logs</h2>
      <div className="bg-card border border-border rounded-lg p-5 mb-4">
        <div className="flex gap-3 items-end">
          <div>
            <label className="block text-sm text-muted-foreground mb-1">Kategorie</label>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="z.B. auth"
              className="bg-muted border border-border rounded-md px-3 py-2 text-foreground text-sm w-40"
            />
          </div>
          <div>
            <label className="block text-sm text-muted-foreground mb-1">Level</label>
            <select
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              className="bg-muted border border-border rounded-md px-3 py-2 text-foreground text-sm"
            >
              <option value="">Alle</option>
              <option value="ERROR">ERROR</option>
              <option value="WARNING">WARNING</option>
              <option value="INFO">INFO</option>
              <option value="DEBUG">DEBUG</option>
            </select>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:opacity-90 disabled:opacity-50"
          >
            {loading ? 'Lädt...' : 'Filtern'}
          </button>
          <a
            href={exportUrl}
            className="px-4 py-2 bg-muted border border-border rounded-md text-sm text-foreground hover:bg-border transition-colors"
            download
          >
            CSV Export
          </a>
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr className="text-muted-foreground text-left">
              <th className="px-4 py-3 whitespace-nowrap">Zeitstempel</th>
              <th className="px-4 py-3">Level</th>
              <th className="px-4 py-3">Kategorie</th>
              <th className="px-4 py-3">Nachricht</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id} className="border-t border-border hover:bg-muted/30">
                <td className="px-4 py-2 text-muted-foreground whitespace-nowrap font-mono text-xs">{new Date(log.timestamp).toLocaleString()}</td>
                <td className={`px-4 py-2 font-bold text-xs ${LEVEL_COLORS[log.level] ?? 'text-gray-400'}`}>{log.level}</td>
                <td className="px-4 py-2 text-muted-foreground text-xs">{log.category}</td>
                <td className="px-4 py-2 text-foreground">{log.message}</td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">
                  {loading ? 'Lädt...' : 'Keine Logs gefunden.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
