import { useEffect, useState } from 'react'
import { Plus, Pencil } from 'lucide-react'
import { StatusBadge } from '@/components/StatusBadge'
import { ServerModal } from '@/components/ServerModal'
import client from '@/api/client'

interface Server {
  id: number
  name: string
  host: string
  port: number
  ssh_user: string
  ssh_key_path?: string | null
  description?: string | null
  status: string
  tags: string[]
}

export default function Servers() {
  const [servers, setServers] = useState<Server[]>([])
  const [testResults, setTestResults] = useState<Record<number, string>>({})
  const [modalOpen, setModalOpen] = useState(false)
  const [editServer, setEditServer] = useState<Server | null>(null)

  const fetchServers = () => {
    client.get('/servers/').then((r) => setServers(r.data)).catch(() => {})
  }

  useEffect(() => {
    fetchServers()
  }, [])

  const testConnection = (id: number) => {
    setTestResults((prev) => ({ ...prev, [id]: 'testing...' }))
    client.post(`/servers/${id}/test-connection`)
      .then((r) => setTestResults((prev) => ({ ...prev, [id]: r.data.status ?? 'ok' })))
      .catch(() => setTestResults((prev) => ({ ...prev, [id]: 'error' })))
  }

  const openCreate = () => { setEditServer(null); setModalOpen(true) }
  const openEdit = (server: Server) => { setEditServer(server); setModalOpen(true) }
  const handleSaved = () => { fetchServers() }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-foreground">Server</h2>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <Plus size={16} />
          Server hinzufügen
        </button>
      </div>
      <div className="space-y-3">
        {servers.map((server) => (
          <div key={server.id} className="bg-card border border-border rounded-lg p-5">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <span className="font-semibold text-foreground text-lg">{server.name}</span>
                <StatusBadge status={server.status} />
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => openEdit(server)}
                  className="p-1.5 text-sm text-muted-foreground border border-border rounded-md hover:text-foreground hover:bg-muted transition-colors"
                  title="Server bearbeiten"
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => testConnection(server.id)}
                  className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:opacity-90 transition-opacity"
                >
                  Test Connection
                </button>
              </div>
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

      {modalOpen && (
        <ServerModal
          server={editServer}
          onClose={() => setModalOpen(false)}
          onSave={handleSaved}
        />
      )}
    </div>
  )
}
