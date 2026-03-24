import { useEffect, useState } from 'react'
import { StatusBadge } from '@/components/StatusBadge'
import client from '@/api/client'

interface Server {
  id: number
  name: string
  host: string
  port: number
  ssh_user: string
  status: string
  tags: string[]
}

export default function Servers() {
  const [servers, setServers] = useState<Server[]>([])
  const [testResults, setTestResults] = useState<Record<number, string>>({})

  useEffect(() => {
    client.get('/servers/').then((r) => setServers(r.data)).catch(() => {})
  }, [])

  const testConnection = (id: number) => {
    setTestResults((prev) => ({ ...prev, [id]: 'testing...' }))
    client.post(`/servers/${id}/test-connection`)
      .then((r) => setTestResults((prev) => ({ ...prev, [id]: r.data.status ?? 'ok' })))
      .catch(() => setTestResults((prev) => ({ ...prev, [id]: 'error' })))
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-foreground mb-6">Server</h2>
      <div className="space-y-3">
        {servers.map((server) => (
          <div key={server.id} className="bg-card border border-border rounded-lg p-5">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <span className="font-semibold text-foreground text-lg">{server.name}</span>
                <StatusBadge status={server.status} />
              </div>
              <button
                onClick={() => testConnection(server.id)}
                className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:opacity-90 transition-opacity"
              >
                Test Connection
              </button>
            </div>
            <div className="text-muted-foreground text-sm space-y-1">
              <div><span className="text-foreground">Host:</span> {server.host}:{server.port}</div>
              <div><span className="text-foreground">SSH User:</span> {server.ssh_user}</div>
              {server.tags && server.tags.length > 0 && (
                <div className="flex gap-1 mt-1">
                  {server.tags.map((tag) => (
                    <span key={tag} className="px-2 py-0.5 bg-muted rounded-md text-xs">{tag}</span>
                  ))}
                </div>
              )}
              {testResults[server.id] && (
                <div className={`mt-2 text-xs font-medium ${testResults[server.id] === 'error' ? 'text-red-400' : 'text-green-400'}`}>
                  Test: {testResults[server.id]}
                </div>
              )}
            </div>
          </div>
        ))}
        {servers.length === 0 && <p className="text-muted-foreground">Keine Server konfiguriert.</p>}
      </div>
    </div>
  )
}
