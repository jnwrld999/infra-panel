import { useEffect, useState } from 'react'
import { Plus, RefreshCw, Eye, Power, X, Loader, List, LayoutGrid, AlertCircle } from 'lucide-react'
import client from '@/api/client'
import { useUIStore } from '@/store/uiStore'

interface Server { id: number; name: string }
interface Plugin { name: string; filename: string; status: string; type: string }
interface ServerPluginConfig { serverId: number; serverName: string; path: string; plugins: Plugin[]; loading: boolean; error?: string | null }

interface Bot { id: number; name: string; server_id?: number; status?: string; description?: string; restricted?: boolean }
interface BotCogConfig { botId: number; botName: string; serverId: number; botPath: string; cogs: Plugin[]; loading: boolean; error?: string | null }

// Real server-side paths per bot ID (root@45.13.227.179)
const BOT_DEFAULT_PATHS: Record<number, string> = {
  1:  '/root/AxellottenTV',
  2:  '/root/JuiceBots-Website',
  3:  '/root/GalaxycraftBots/GalaxycraftBot',
  4:  '/root/GalaxycraftBots/TicketBot',
  5:  '/root/GalaxycraftBots/GalaxycraftVerify',
  6:  '/home/juice/HarryoeBot',
  7:  '/home/juice/CarstenBot',
  8:  '/home/juice/Asker',
  9:  '/root/AmongUSBot',
  10: '/root/NovaBot',
  11: '/root/MursrtxBot',
}

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
  const [category, setCategory] = useState<'minecraft' | 'discord'>('minecraft')
  const [selectedBotId, setSelectedBotId] = useState<number | null>(null)
  const [configs, setConfigs] = useState<ServerPluginConfig[]>([])
  const [botConfigs, setBotConfigs] = useState<BotCogConfig[]>([])
  const [fileViewer, setFileViewer] = useState<{ serverId: number; path: string; content: string; name: string } | null>(null)
  const [addPathModal, setAddPathModal] = useState<{ serverId: number; serverName: string } | null>(null)
  const [addBotPathModal, setAddBotPathModal] = useState<{ botId: number; botName: string } | null>(null)
  const [addPathValue, setAddPathValue] = useState('')

  const { pluginView, setPluginView } = useUIStore()

  useEffect(() => {
    client.get<Server[]>('/servers/').then((r) => {
      const savedPaths = getSavedPaths()
      const newConfigs = r.data.map((s) => ({
        serverId: s.id,
        serverName: s.name,
        path: savedPaths[String(s.id)] || '/opt/minecraft/plugins',
        plugins: [],
        loading: false,
      }))
      setConfigs(newConfigs)
      useUIStore.getState().setLastReload(new Date())
      // Auto-load immediately
      newConfigs.forEach(c => loadPluginsForServer(c.serverId, c.path))
    }).catch(() => {})
  }, [])

  useEffect(() => {
    if (category === 'discord' && botConfigs.length === 0) {
      client.get<Bot[]>('/bots/').then((r) => {
        const nonRestricted = r.data.filter((b) => !b.restricted && b.server_id)
        const savedPaths = getSavedPaths()
        setBotConfigs(nonRestricted.map((b) => ({
          botId: b.id,
          botName: b.name,
          serverId: b.server_id!,
          botPath: savedPaths[`bot_${b.id}`] || BOT_DEFAULT_PATHS[b.id] || `/root/${b.name}`,
          cogs: [],
          loading: false,
        })))
      }).catch(() => {})
    }
  }, [category])

  // Auto-load cogs when a bot is selected
  useEffect(() => {
    if (selectedBotId !== null) {
      const config = botConfigs.find(c => c.botId === selectedBotId)
      if (config && config.cogs.length === 0 && !config.loading) {
        loadCogsForBot(selectedBotId)
      }
    }
  }, [selectedBotId])

  const loadPluginsForServer = (serverId: number, path: string) => {
    setConfigs((prev) => prev.map((c) => c.serverId === serverId ? { ...c, loading: true, error: null } : c))
    client.get<Plugin[]>(`/plugins/minecraft/${serverId}?plugins_path=${encodeURIComponent(path)}`)
      .then((r) => setConfigs((prev) => prev.map((c) => c.serverId === serverId ? { ...c, plugins: r.data, loading: false, error: null } : c)))
      .catch((e) => setConfigs((prev) => prev.map((c) => c.serverId === serverId ? { ...c, plugins: [], loading: false, error: e?.response?.data?.detail || 'SSH-Verbindung fehlgeschlagen' } : c)))
  }

  const loadCogsForBot = (botId: number, botPath?: string) => {
    const config = botConfigs.find((c) => c.botId === botId)
    const path = botPath ?? config?.botPath
    setBotConfigs((prev) => prev.map((c) => c.botId === botId ? { ...c, loading: true, error: null } : c))
    const url = path
      ? `/plugins/discord-bot/${botId}?bot_path=${encodeURIComponent(path)}`
      : `/plugins/discord-bot/${botId}`
    client.get<Plugin[]>(url)
      .then((r) => setBotConfigs((prev) => prev.map((c) => c.botId === botId ? { ...c, cogs: r.data, loading: false, error: null } : c)))
      .catch((e) => setBotConfigs((prev) => prev.map((c) => c.botId === botId ? { ...c, cogs: [], loading: false, error: e?.response?.data?.detail || 'SSH-Verbindung fehlgeschlagen' } : c)))
  }

  const loadAll = () => {
    if (category === 'minecraft') {
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
    setConfigs((prev) => prev.map((c) => c.serverId === serverId ? { ...c, path, error: null } : c))
    loadPluginsForServer(serverId, path)
    setAddPathModal(null)
  }

  const applyBotPath = (botId: number, path: string) => {
    const paths = getSavedPaths()
    paths[`bot_${botId}`] = path
    localStorage.setItem(PATHS_KEY, JSON.stringify(paths))
    setBotConfigs((prev) => prev.map((c) => c.botId === botId ? { ...c, botPath: path, error: null } : c))
    loadCogsForBot(botId, path)
    setAddBotPathModal(null)
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-foreground">Plugins & Cogs</h2>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex gap-0.5 p-0.5 bg-muted rounded-lg">
            <button onClick={() => setPluginView('list')}
              className={`p-1.5 rounded-md transition-colors ${pluginView === 'list' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
              <List size={14} />
            </button>
            <button onClick={() => setPluginView('grid')}
              className={`p-1.5 rounded-md transition-colors ${pluginView === 'grid' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
              <LayoutGrid size={14} />
            </button>
          </div>
          {/* Reload all */}
          <button onClick={loadAll} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <RefreshCw size={14} />
            Alle laden
          </button>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Left nav */}
        <nav className="w-44 flex-shrink-0 space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-2 mb-2">Kategorie</p>
          {(['minecraft', 'discord'] as const).map(cat => (
            <button key={cat}
              onClick={() => { setCategory(cat); setSelectedBotId(null) }}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                category === cat
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}>
              {cat === 'minecraft' ? '⛏ Minecraft' : '🤖 Discord Bots'}
            </button>
          ))}

          {category === 'discord' && botConfigs.length > 0 && (
            <>
              <div className="h-px bg-border my-3" />
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-2 mb-2">Bot wählen</p>
              {botConfigs.map(b => (
                <button key={b.botId}
                  onClick={() => setSelectedBotId(b.botId)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm truncate transition-colors ${
                    selectedBotId === b.botId
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}>
                  {b.botName}
                </button>
              ))}
            </>
          )}
        </nav>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          {/* Minecraft category */}
          {category === 'minecraft' && (
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
                  {config.error && !config.loading && (
                    <div className="px-5 py-4">
                      <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                        <AlertCircle size={14} className="flex-shrink-0" />
                        {config.error}
                      </div>
                    </div>
                  )}
                  {!config.error && config.plugins.length === 0 && !config.loading && (
                    <div className="px-5 py-8 text-center text-sm text-muted-foreground">
                      Noch nicht geladen — klicke "Laden"
                    </div>
                  )}
                  {config.loading && (
                    <div className="px-5 py-8 text-center text-sm text-muted-foreground">
                      <Loader size={16} className="animate-spin inline mr-2" />Lädt...
                    </div>
                  )}
                  {!config.loading && config.plugins.length > 0 && (
                    pluginView === 'list' ? (
                      <div className="divide-y divide-border">
                        {config.plugins.map((plugin) => (
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
                    ) : (
                      <div className="grid grid-cols-2 gap-3 p-3">
                        {config.plugins.map((plugin) => (
                          <div key={plugin.filename} className="bg-muted/30 border border-border rounded-lg p-3 flex flex-col gap-2 hover:bg-muted/50 transition-colors">
                            <div className="flex items-center gap-2">
                              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${plugin.status === 'active' ? 'bg-green-400' : 'bg-red-400'}`} />
                              <p className="text-sm font-medium text-foreground truncate">{plugin.name}</p>
                            </div>
                            <p className="text-xs text-muted-foreground truncate">{plugin.filename}</p>
                            <button onClick={() => togglePlugin(config.serverId, plugin)}
                              className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs transition-colors w-fit ${plugin.status === 'active' ? 'text-red-400 hover:bg-red-500/10' : 'text-green-400 hover:bg-green-500/10'}`}>
                              <Power size={13} />
                              {plugin.status === 'active' ? 'Deaktivieren' : 'Aktivieren'}
                            </button>
                          </div>
                        ))}
                      </div>
                    )
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Discord: no bot selected */}
          {category === 'discord' && selectedBotId === null && (
            <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
              ← Bot aus der Liste auswählen
            </div>
          )}

          {/* Discord: bot selected */}
          {category === 'discord' && selectedBotId !== null && (() => {
            const config = botConfigs.find(c => c.botId === selectedBotId)
            if (!config) return null
            return (
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-muted/30">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-semibold text-foreground text-sm">{config.botName}</span>
                    <span className="text-xs text-muted-foreground font-mono truncate">{config.botPath}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => { setAddBotPathModal({ botId: config.botId, botName: config.botName }); setAddPathValue(config.botPath) }}
                      className="flex items-center gap-1 px-2 py-1 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors border border-border">
                      <Plus size={12} /> Pfad
                    </button>
                    <button onClick={() => loadCogsForBot(config.botId)}
                      disabled={config.loading}
                      className="flex items-center gap-1 px-2 py-1 rounded-md text-xs text-primary hover:bg-primary/10 transition-colors border border-primary/30 disabled:opacity-50">
                      {config.loading ? <><Loader size={12} className="animate-spin" />Cogs laden...</> : <><RefreshCw size={12} />Cogs laden</>}
                    </button>
                  </div>
                </div>
                {config.error && !config.loading && (
                  <div className="px-5 py-4">
                    <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                      <AlertCircle size={14} className="flex-shrink-0" />
                      {config.error}
                    </div>
                  </div>
                )}
                {!config.error && config.cogs.length === 0 && !config.loading && (
                  <div className="px-5 py-8 text-center text-sm text-muted-foreground">
                    Noch nicht geladen — klicke "Cogs laden"
                  </div>
                )}
                {config.loading && (
                  <div className="px-5 py-8 text-center text-sm text-muted-foreground">
                    <Loader size={16} className="animate-spin inline mr-2" />Cogs laden...
                  </div>
                )}
                {!config.loading && config.cogs.length > 0 && (
                  pluginView === 'list' ? (
                    <div className="divide-y divide-border">
                      {config.cogs.map((cog) => {
                        const filePath = cog.type === 'java'
                          ? `${config.botPath}/src/main/java/main/${cog.filename}`
                          : cog.type === 'nodejs'
                            ? `${config.botPath}/src/${cog.filename}`
                            : `${config.botPath}/cogs/${cog.filename}`
                        return (
                          <div key={cog.filename} className="flex items-center justify-between px-5 py-3 hover:bg-muted/20 transition-colors">
                            <div className="flex items-center gap-3 min-w-0">
                              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                                cog.type === 'java' ? 'bg-orange-400' : cog.type === 'nodejs' ? 'bg-green-400' : 'bg-blue-400'
                              }`} />
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
                  ) : (
                    <div className="grid grid-cols-2 gap-3 p-3">
                      {config.cogs.map((cog) => {
                        const filePath = cog.type === 'java'
                          ? `${config.botPath}/src/main/java/main/${cog.filename}`
                          : cog.type === 'nodejs'
                            ? `${config.botPath}/src/${cog.filename}`
                            : `${config.botPath}/cogs/${cog.filename}`
                        return (
                          <div key={cog.filename} className="bg-muted/30 border border-border rounded-lg p-3 flex flex-col gap-2 hover:bg-muted/50 transition-colors">
                            <div className="flex items-center gap-2">
                              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                                cog.type === 'java' ? 'bg-orange-400' : cog.type === 'nodejs' ? 'bg-green-400' : 'bg-blue-400'
                              }`} />
                              <p className="text-sm font-medium text-foreground truncate">{cog.name}</p>
                            </div>
                            <p className="text-xs text-muted-foreground truncate">{cog.filename}</p>
                            <button onClick={() => viewFile(config.serverId, filePath, cog.name)}
                              className="flex items-center gap-1 px-2 py-1 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors w-fit">
                              <Eye size={13} /> Code
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  )
                )}
              </div>
            )
          })()}
        </div>
      </div>

      {/* Bot path edit modal */}
      {addBotPathModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h3 className="font-semibold text-foreground text-sm">Bot-Pfad — {addBotPathModal.botName}</h3>
              <button onClick={() => setAddBotPathModal(null)} className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"><X size={15} /></button>
            </div>
            <div className="px-5 py-4">
              <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Pfad auf dem Server</label>
              <input
                type="text"
                value={addPathValue}
                onChange={(e) => setAddPathValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && applyBotPath(addBotPathModal.botId, addPathValue)}
                placeholder="/home/juice/MeinUbuntuServer/BotName"
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-primary/50"
                autoFocus
              />
              <p className="mt-1.5 text-xs text-muted-foreground">Stammverzeichnis des Bots (enthält cogs/)</p>
            </div>
            <div className="flex gap-2 px-5 pb-4 justify-end">
              <button onClick={() => setAddBotPathModal(null)} className="px-3 py-2 text-sm rounded-lg border border-border text-muted-foreground hover:bg-muted">Abbrechen</button>
              <button onClick={() => applyBotPath(addBotPathModal.botId, addPathValue)} className="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:opacity-90">Übernehmen & Laden</button>
            </div>
          </div>
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
