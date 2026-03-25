import { useEffect, useState } from 'react'
import { Plus, RefreshCw, Eye, Power, X, Loader } from 'lucide-react'
import client from '@/api/client'

interface Server { id: number; name: string }
interface Plugin { name: string; filename: string; status: string; type: string }
interface ServerPluginConfig { serverId: number; serverName: string; path: string; plugins: Plugin[]; loading: boolean }

interface Bot { id: number; name: string; server_id?: number; status?: string; description?: string; restricted?: boolean }
interface BotCogConfig { botId: number; botName: string; serverId: number; botPath: string; cogs: Plugin[]; loading: boolean }

// Saved plugin paths per server in localStorage
const PATHS_KEY = 'infra-plugin-paths'
function getSavedPaths(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(PATHS_KEY) || '{}') } catch { return {} }
}
function savePath(serverId: number, path: string) {
  const paths = getSavedPaths()
  paths[String(serverId)] = path
  localStorage.setItem(PATHS_KEY, JSON.stringify(paths))
}

export default function Plugins() {
  const [tab, setTab] = useState<'minecraft' | 'discord'>('minecraft')
  const [configs, setConfigs] = useState<ServerPluginConfig[]>([])
  const [botConfigs, setBotConfigs] = useState<BotCogConfig[]>([])
  const [fileViewer, setFileViewer] = useState<{ serverId: number; path: string; content: string; name: string } | null>(null)
  const [addPathModal, setAddPathModal] = useState<{ serverId: number; serverName: string } | null>(null)
  const [addPathValue, setAddPathValue] = useState('')

  useEffect(() => {
    client.get<Server[]>('/servers/').then((r) => {
      const savedPaths = getSavedPaths()
      setConfigs(r.data.map((s) => ({
        serverId: s.id,
        serverName: s.name,
        path: savedPaths[String(s.id)] || '/opt/minecraft/plugins',
        plugins: [],
        loading: false,
      })))
    }).catch(() => {})
  }, [])

  useEffect(() => {
    if (tab === 'discord' && botConfigs.length === 0) {
      client.get<Bot[]>('/bots/').then((r) => {
        const nonRestricted = r.data.filter((b) => !b.restricted && b.server_id)
        const savedPaths = getSavedPaths()
        setBotConfigs(nonRestricted.map((b) => ({
          botId: b.id,
          botName: b.name,
          serverId: b.server_id!,
          botPath: savedPaths[`bot_${b.id}`] || `/root/${b.name}`,
          cogs: [],
          loading: false,
        })))
      }).catch(() => {})
    }
  }, [tab])

  const loadPluginsForServer = (serverId: number, path: string) => {
    setConfigs((prev) => prev.map((c) => c.serverId === serverId ? { ...c, loading: true } : c))
    client.get<Plugin[]>(`/plugins/minecraft/${serverId}?plugins_path=${encodeURIComponent(path)}`)
      .then((r) => setConfigs((prev) => prev.map((c) => c.serverId === serverId ? { ...c, plugins: r.data, loading: false } : c)))
      .catch(() => setConfigs((prev) => prev.map((c) => c.serverId === serverId ? { ...c, plugins: [], loading: false } : c)))
  }

  const loadCogsForBot = (botId: number) => {
    setBotConfigs((prev) => prev.map((c) => c.botId === botId ? { ...c, loading: true } : c))
    client.get<Plugin[]>(`/plugins/discord-bot/${botId}`)
      .then((r) => setBotConfigs((prev) => prev.map((c) => c.botId === botId ? { ...c, cogs: r.data, loading: false } : c)))
      .catch(() => setBotConfigs((prev) => prev.map((c) => c.botId === botId ? { ...c, cogs: [], loading: false } : c)))
  }

  const loadAll = () => {
    if (tab === 'minecraft') {
      configs.forEach((c) => loadPluginsForServer(c.serverId, c.path))
    } else {
      botConfigs.forEach((c) => loadCogsForBot(c.botId))
    }
  }

  const togglePlugin = (serverId: number, plugin: Plugin) => {
    const config = configs.find((c) => c.serverId === serverId)
    if (!config) return
    const endpoint = plugin.status === 'active'
      ? `/plugins/minecraft/${serverId}/disable`
      : `/plugins/minecraft/${serverId}/enable`
    client.post(`${endpoint}?filename=${encodeURIComponent(plugin.filename)}&plugins_path=${encodeURIComponent(config.path)}`)
      .then(() => loadPluginsForServer(serverId, config.path))
      .catch(() => {})
  }

  const viewFile = (serverId: number, path: string, name: string) => {
    client.get<{ content: string }>(`/plugins/read-file?server_id=${serverId}&path=${encodeURIComponent(path)}`)
      .then((r) => setFileViewer({ serverId, path, content: r.data.content, name }))
      .catch(() => setFileViewer({ serverId, path, content: '(Datei konnte nicht geladen werden)', name }))
  }

  const applyPath = (serverId: number, path: string) => {
    savePath(serverId, path)
    setConfigs((prev) => prev.map((c) => c.serverId === serverId ? { ...c, path } : c))
    loadPluginsForServer(serverId, path)
    setAddPathModal(null)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-foreground">Plugins</h2>
        <button onClick={loadAll} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
          <RefreshCw size={14} />
          Alle laden
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-muted rounded-lg p-1 w-fit">
        {(['minecraft', 'discord'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === t ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
            {t === 'minecraft' ? '⛏ Minecraft' : '🤖 Discord Bots'}
          </button>
        ))}
      </div>

      {/* Minecraft tab */}
      {tab === 'minecraft' && (
        <div className="space-y-4">
          {configs.map((config) => (
            <div key={config.serverId} className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-muted/30">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground text-sm">{config.serverName}</span>
                  <span className="text-xs text-muted-foreground font-mono">{config.path}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => { setAddPathModal({ serverId: config.serverId, serverName: config.serverName }); setAddPathValue(config.path) }}
                    className="flex items-center gap-1 px-2 py-1 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors border border-border">
                    <Plus size={12} /> Pfad
                  </button>
                  <button onClick={() => loadPluginsForServer(config.serverId, config.path)}
                    disabled={config.loading}
                    className="flex items-center gap-1 px-2 py-1 rounded-md text-xs text-primary hover:bg-primary/10 transition-colors border border-primary/30 disabled:opacity-50">
                    {config.loading ? <Loader size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                    Laden
                  </button>
                </div>
              </div>
              <div className="divide-y divide-border">
                {config.plugins.length === 0 && !config.loading && (
                  <div className="px-5 py-8 text-center text-sm text-muted-foreground">
                    Noch nicht geladen — klicke "Laden"
                  </div>
                )}
                {config.loading && (
                  <div className="px-5 py-8 text-center text-sm text-muted-foreground">
                    <Loader size={16} className="animate-spin inline mr-2" />Lädt...
                  </div>
                )}
                {!config.loading && config.plugins.map((plugin) => (
                  <div key={plugin.filename} className="flex items-center justify-between px-5 py-3 hover:bg-muted/20 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${plugin.status === 'active' ? 'bg-green-400' : 'bg-red-400'}`} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{plugin.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{plugin.filename}</p>
                      </div>
                    </div>
                    <button onClick={() => togglePlugin(config.serverId, plugin)}
                      className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs transition-colors ${plugin.status === 'active' ? 'text-red-400 hover:bg-red-500/10' : 'text-green-400 hover:bg-green-500/10'}`}>
                      <Power size={13} />
                      {plugin.status === 'active' ? 'Deaktivieren' : 'Aktivieren'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Discord tab */}
      {tab === 'discord' && (
        <div className="space-y-4">
          {botConfigs.map((config) => (
            <div key={config.botId} className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-muted/30">
                <span className="font-semibold text-foreground text-sm">{config.botName}</span>
                <button onClick={() => loadCogsForBot(config.botId)}
                  disabled={config.loading}
                  className="flex items-center gap-1 px-2 py-1 rounded-md text-xs text-primary hover:bg-primary/10 transition-colors border border-primary/30 disabled:opacity-50">
                  {config.loading ? <Loader size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                  Laden
                </button>
              </div>
              <div className="divide-y divide-border">
                {config.cogs.length === 0 && !config.loading && (
                  <div className="px-5 py-8 text-center text-sm text-muted-foreground">
                    Noch nicht geladen — klicke "Laden"
                  </div>
                )}
                {config.loading && (
                  <div className="px-5 py-8 text-center text-sm text-muted-foreground">
                    <Loader size={16} className="animate-spin inline mr-2" />Lädt...
                  </div>
                )}
                {!config.loading && config.cogs.map((cog) => {
                  const filePath = `${config.botPath}/cogs/${cog.filename}`
                  return (
                    <div key={cog.filename} className="flex items-center justify-between px-5 py-3 hover:bg-muted/20 transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-2 h-2 rounded-full flex-shrink-0 bg-blue-400" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{cog.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{cog.filename}</p>
                        </div>
                      </div>
                      <button onClick={() => viewFile(config.serverId, filePath, cog.name)}
                        className="flex items-center gap-1 px-2 py-1 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                        <Eye size={13} /> Code
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
          {botConfigs.length === 0 && (
            <div className="text-center text-sm text-muted-foreground py-10">Keine Bots verfügbar.</div>
          )}
        </div>
      )}

      {/* Path edit modal */}
      {addPathModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h3 className="font-semibold text-foreground text-sm">Plugin-Pfad — {addPathModal.serverName}</h3>
              <button onClick={() => setAddPathModal(null)} className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"><X size={15} /></button>
            </div>
            <div className="px-5 py-4">
              <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Pfad auf dem Server</label>
              <input
                type="text"
                value={addPathValue}
                onChange={(e) => setAddPathValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && applyPath(addPathModal.serverId, addPathValue)}
                placeholder="/opt/minecraft/plugins"
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-primary/50"
                autoFocus
              />
              <p className="mt-1.5 text-xs text-muted-foreground">Ordner mit .jar Dateien</p>
            </div>
            <div className="flex gap-2 px-5 pb-4 justify-end">
              <button onClick={() => setAddPathModal(null)} className="px-3 py-2 text-sm rounded-lg border border-border text-muted-foreground hover:bg-muted">Abbrechen</button>
              <button onClick={() => applyPath(addPathModal.serverId, addPathValue)} className="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:opacity-90">Übernehmen & Laden</button>
            </div>
          </div>
        </div>
      )}

      {/* File viewer modal */}
      {fileViewer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
              <div>
                <h3 className="font-semibold text-foreground text-sm">{fileViewer.name}</h3>
                <p className="text-xs text-muted-foreground font-mono mt-0.5">{fileViewer.path}</p>
              </div>
              <button onClick={() => setFileViewer(null)} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"><X size={16} /></button>
            </div>
            <div className="flex-1 overflow-auto p-4 min-h-0">
              <pre className="text-xs font-mono text-foreground whitespace-pre-wrap leading-relaxed">{fileViewer.content || '(leer)'}</pre>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
