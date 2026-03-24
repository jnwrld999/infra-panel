import { useEffect, useState } from 'react'
import client from '@/api/client'

interface Server {
  id: number
  name: string
}

interface Plugin {
  name: string
  enabled: boolean
  path: string
}

export default function Plugins() {
  const [servers, setServers] = useState<Server[]>([])
  const [selectedServer, setSelectedServer] = useState<string>('')
  const [pluginPath, setPluginPath] = useState('')
  const [plugins, setPlugins] = useState<Plugin[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    client.get('/servers/').then((r) => setServers(r.data)).catch(() => {})
  }, [])

  const loadPlugins = () => {
    if (!selectedServer) return
    setLoading(true)
    client.get(`/plugins/?server_id=${selectedServer}&path=${encodeURIComponent(pluginPath)}`)
      .then((r) => setPlugins(r.data))
      .catch(() => setPlugins([]))
      .finally(() => setLoading(false))
  }

  const togglePlugin = (plugin: Plugin) => {
    const endpoint = plugin.enabled ? '/plugins/disable' : '/plugins/enable'
    client.post(endpoint, { server_id: Number(selectedServer), path: plugin.path })
      .then(() => loadPlugins())
      .catch(() => {})
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-foreground mb-6">Plugins</h2>
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
          <div className="flex-1">
            <label className="block text-sm text-muted-foreground mb-1">Plugin-Pfad</label>
            <input
              type="text"
              value={pluginPath}
              onChange={(e) => setPluginPath(e.target.value)}
              placeholder="/pfad/zu/plugins"
              className="w-full bg-muted border border-border rounded-md px-3 py-2 text-foreground text-sm"
            />
          </div>
          <button
            onClick={loadPlugins}
            disabled={loading || !selectedServer}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:opacity-90 disabled:opacity-50"
          >
            {loading ? 'Lädt...' : 'Laden'}
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {plugins.map((plugin) => (
          <div key={plugin.name} className="bg-card border border-border rounded-lg px-5 py-3 flex items-center justify-between">
            <span className="text-foreground font-medium">{plugin.name}</span>
            <button
              onClick={() => togglePlugin(plugin)}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                plugin.enabled
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : 'bg-green-600 hover:bg-green-700 text-white'
              }`}
            >
              {plugin.enabled ? 'Deaktivieren' : 'Aktivieren'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
