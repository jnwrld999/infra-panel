import { useEffect, useState } from 'react'
import client from '@/api/client'

interface Server {
  id: number
  name: string
}

interface Process {
  name: string
  status: string
  pid?: number
}

interface Container {
  id: string
  name: string
  status: string
  image: string
}

export default function Services() {
  const [servers, setServers] = useState<Server[]>([])
  const [selectedServer, setSelectedServer] = useState<string>('')
  const [processes, setProcesses] = useState<Process[]>([])
  const [containers, setContainers] = useState<Container[]>([])
  const [view, setView] = useState<'pm2' | 'docker' | null>(null)

  useEffect(() => {
    client.get('/servers/').then((r) => setServers(r.data)).catch(() => {})
  }, [])

  const loadPm2 = () => {
    if (!selectedServer) return
    setView('pm2')
    client.get(`/services/pm2?server_id=${selectedServer}`)
      .then((r) => setProcesses(r.data))
      .catch(() => setProcesses([]))
  }

  const loadDocker = () => {
    if (!selectedServer) return
    setView('docker')
    client.get(`/services/docker?server_id=${selectedServer}`)
      .then((r) => setContainers(r.data))
      .catch(() => setContainers([]))
  }

  const pm2Action = (name: string, action: string) => {
    client.post(`/services/pm2/${action}`, { server_id: Number(selectedServer), name })
      .then(() => loadPm2())
      .catch(() => {})
  }

  const dockerAction = (containerId: string, action: string) => {
    client.post(`/services/docker/${action}`, { server_id: Number(selectedServer), container_id: containerId })
      .then(() => loadDocker())
      .catch(() => {})
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-foreground mb-6">Dienste</h2>
      <div className="bg-card border border-border rounded-lg p-5 mb-4">
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="block text-sm text-muted-foreground mb-1">Server</label>
            <select
              value={selectedServer}
              onChange={(e) => setSelectedServer(e.target.value)}
              className="w-full bg-muted border border-border rounded-md px-3 py-2 text-foreground text-sm"
            >
              <option value="">Server wählen...</option>
              {servers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <button
            onClick={loadPm2}
            disabled={!selectedServer}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:opacity-90 disabled:opacity-50"
          >
            PM2 Liste
          </button>
          <button
            onClick={loadDocker}
            disabled={!selectedServer}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:opacity-90 disabled:opacity-50"
          >
            Docker Liste
          </button>
        </div>
      </div>

      {view === 'pm2' && (
        <div className="space-y-2">
          <h3 className="font-semibold text-foreground mb-2">PM2 Prozesse</h3>
          {processes.map((proc) => (
            <div key={proc.name} className="bg-card border border-border rounded-lg px-5 py-3 flex items-center justify-between">
              <div>
                <span className="text-foreground font-medium">{proc.name}</span>
                <span className={`ml-3 text-xs ${proc.status === 'online' ? 'text-green-400' : 'text-red-400'}`}>{proc.status}</span>
              </div>
              <div className="flex gap-2">
                <button onClick={() => pm2Action(proc.name, 'restart')} className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-md">Restart</button>
                <button onClick={() => pm2Action(proc.name, 'stop')} className="px-3 py-1 text-xs bg-red-600 hover:bg-red-700 text-white rounded-md">Stop</button>
              </div>
            </div>
          ))}
          {processes.length === 0 && <p className="text-muted-foreground text-sm">Keine PM2-Prozesse gefunden.</p>}
        </div>
      )}

      {view === 'docker' && (
        <div className="space-y-2">
          <h3 className="font-semibold text-foreground mb-2">Docker Container</h3>
          {containers.map((c) => (
            <div key={c.id} className="bg-card border border-border rounded-lg px-5 py-3 flex items-center justify-between">
              <div>
                <span className="text-foreground font-medium">{c.name}</span>
                <span className="ml-2 text-muted-foreground text-xs">{c.image}</span>
                <span className={`ml-3 text-xs ${c.status.includes('Up') ? 'text-green-400' : 'text-red-400'}`}>{c.status}</span>
              </div>
              <div className="flex gap-2">
                <button onClick={() => dockerAction(c.id, 'restart')} className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-md">Restart</button>
                <button onClick={() => dockerAction(c.id, 'stop')} className="px-3 py-1 text-xs bg-red-600 hover:bg-red-700 text-white rounded-md">Stop</button>
              </div>
            </div>
          ))}
          {containers.length === 0 && <p className="text-muted-foreground text-sm">Keine Docker Container gefunden.</p>}
        </div>
      )}
    </div>
  )
}
