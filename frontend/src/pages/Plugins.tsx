import { useEffect, useState } from 'react'
import { Plus, RefreshCw, Eye, X, Loader, List, LayoutGrid, AlertCircle, MessageSquare } from 'lucide-react'
import client from '@/api/client'
import { useUIStore } from '@/store/uiStore'
import { useAuthStore } from '@/store/authStore'

interface Plugin { name: string; filename: string; status: string; type: string }
interface Bot { id: number; name: string; server_id?: number; status?: string; restricted?: boolean }
interface BotCogConfig { botId: number; botName: string; serverId: number; botPath: string; cogs: Plugin[]; loading: boolean; error?: string | null }

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
  12: '/root/BeardedBot',
  13: '/root/Mursrtx-Bot',
}

const PATHS_KEY = 'infra-plugin-paths'
function getSavedPaths(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(PATHS_KEY) || '{}') } catch { return {} }
}

export default function Plugins() {
  const { user } = useAuthStore()
  const { pluginView, setPluginView, previewUser } = useUIStore()
  const effectiveUser = previewUser ?? user
  const isBotOwner = effectiveUser?.role === 'bot_owner'
  const assignedBotId = effectiveUser?.assigned_bot?.id ?? null

  const [selectedBotId, setSelectedBotId] = useState<number | null>(null)
  const [botConfigs, setBotConfigs] = useState<BotCogConfig[]>([])
  const [fileViewer, setFileViewer] = useState<{ serverId: number; path: string; content: string; name: string } | null>(null)
  const [addBotPathModal, setAddBotPathModal] = useState<{ botId: number; botName: string } | null>(null)
  const [addPathValue, setAddPathValue] = useState('')
  const [pluginRequestModal, setPluginRequestModal] = useState(false)
  const [requestForm, setRequestForm] = useState({ type: 'plugin_request', description: '' })
  const [requestLoading, setRequestLoading] = useState(false)
  const [requestResult, setRequestResult] = useState<'success' | 'error' | null>(null)

  const submitPluginRequest = () => {
    if (!requestForm.description.trim()) return
    setRequestLoading(true)
    setRequestResult(null)
    client.post('/approvals/', { type: requestForm.type, payload: { description: requestForm.description.trim() } })
      .then(() => {
        setRequestResult('success')
        setTimeout(() => { setPluginRequestModal(false); setRequestResult(null); setRequestForm({ type: 'plugin_request', description: '' }) }, 1500)
      })
      .catch(() => setRequestResult('error'))
      .finally(() => setRequestLoading(false))
  }

  useEffect(() => {
    client.get<Bot[]>('/bots/').then((r) => {
      const nonRestricted = r.data.filter((b) => !b.restricted && b.server_id)
      const savedPaths = getSavedPaths()
      const configs = nonRestricted.map((b) => ({
        botId: b.id,
        botName: b.name,
        serverId: b.server_id!,
        botPath: savedPaths[`bot_${b.id}`] || BOT_DEFAULT_PATHS[b.id] || `/root/${b.name}`,
        cogs: [],
        loading: false,
      }))
      setBotConfigs(configs)
      useUIStore.getState().setLastReload(new Date())

      // For bot_owner: auto-select their bot
      if (isBotOwner && assignedBotId) {
        setSelectedBotId(assignedBotId)
      }
    }).catch(() => {})
  }, [])

  const loadCogsForBot = (botId: number, botPath?: string) => {
    const config = botConfigs.find((c) => c.botId === botId)
    const path = botPath ?? config?.botPath
    setBotConfigs((prev) => prev.map((c) => c.botId === botId ? { ...c, loading: true, error: null } : c))
    const url = path ? `/plugins/discord-bot/${botId}?bot_path=${encodeURIComponent(path)}` : `/plugins/discord-bot/${botId}`
    client.get<Plugin[]>(url)
      .then((r) => setBotConfigs((prev) => prev.map((c) => c.botId === botId ? { ...c, cogs: r.data, loading: false, error: null } : c)))
      .catch((e) => setBotConfigs((prev) => prev.map((c) => c.botId === botId ? { ...c, cogs: [], loading: false, error: e?.response?.data?.detail || 'SSH-Verbindung fehlgeschlagen' } : c)))
  }

  // Auto-load cogs when a bot is selected
  useEffect(() => {
    if (selectedBotId !== null) {
      const config = botConfigs.find(c => c.botId === selectedBotId)
      if (config && config.cogs.length === 0 && !config.loading) {
        loadCogsForBot(selectedBotId)
      }
    }
  }, [selectedBotId, botConfigs.length])

  const applyBotPath = (botId: number, path: string) => {
    const paths = getSavedPaths()
    paths[`bot_${botId}`] = path
    localStorage.setItem(PATHS_KEY, JSON.stringify(paths))
    setBotConfigs((prev) => prev.map((c) => c.botId === botId ? { ...c, botPath: path, error: null } : c))
    loadCogsForBot(botId, path)
    setAddBotPathModal(null)
  }

  const viewFile = (serverId: number, path: string, name: string) => {
    client.get<{ content: string }>(`/plugins/read-file?server_id=${serverId}&path=${encodeURIComponent(path)}`)
      .then((r) => setFileViewer({ serverId, path, content: r.data.content, name }))
      .catch(() => setFileViewer({ serverId, path, content: '(Datei konnte nicht geladen werden)', name }))
  }

  const visibleBots = isBotOwner && assignedBotId
    ? botConfigs.filter(b => b.botId === assignedBotId)
    : botConfigs

  const activeConfig = selectedBotId !== null ? botConfigs.find(c => c.botId === selectedBotId) : null

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-foreground">Plugins & Cogs</h2>
        <div className="flex items-center gap-2">
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
          {selectedBotId !== null && (
            <button onClick={() => loadCogsForBot(selectedBotId)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
              <RefreshCw size={14} /> Neu laden
            </button>
          )}
        </div>
      </div>

      <div className="bg-primary/10 border border-primary/20 rounded-lg px-4 py-3 flex items-start justify-between gap-4 mb-4">
        <div className="flex items-start gap-3">
          <MessageSquare size={16} className="text-primary mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-foreground">Plugin- & Feature-Anfragen</p>
            <p className="text-xs text-muted-foreground mt-0.5">Wünsche für neue Plugins oder Funktionen direkt einreichen.</p>
          </div>
        </div>
        <button onClick={() => setPluginRequestModal(true)}
          className="flex-shrink-0 px-3 py-1.5 bg-primary text-primary-foreground text-xs rounded-md hover:bg-primary/90 transition-colors">
          Anfrage senden
        </button>
      </div>

      <div className="flex gap-6">
        {/* Bot selector — hidden for bot_owner (only 1 bot) */}
        {!isBotOwner && (
          <nav className="w-44 flex-shrink-0 space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-2 mb-2">Bot wählen</p>
            {visibleBots.map(b => (
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
          </nav>
        )}

        <div className="flex-1 min-w-0">
          {selectedBotId === null && (
            <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
              ← Bot aus der Liste auswählen
            </div>
          )}

          {activeConfig && (
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-muted/30">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-semibold text-foreground text-sm">{activeConfig.botName}</span>
                  <span className="text-xs text-muted-foreground font-mono truncate">{activeConfig.botPath}</span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button onClick={() => { setAddBotPathModal({ botId: activeConfig.botId, botName: activeConfig.botName }); setAddPathValue(activeConfig.botPath) }}
                    className="flex items-center gap-1 px-2 py-1 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors border border-border">
                    <Plus size={12} /> Pfad
                  </button>
                  <button onClick={() => loadCogsForBot(activeConfig.botId)}
                    disabled={activeConfig.loading}
                    className="flex items-center gap-1 px-2 py-1 rounded-md text-xs text-primary hover:bg-primary/10 transition-colors border border-primary/30 disabled:opacity-50">
                    {activeConfig.loading ? <><Loader size={12} className="animate-spin" />Lädt...</> : <><RefreshCw size={12} />Cogs laden</>}
                  </button>
                </div>
              </div>

              {activeConfig.error && !activeConfig.loading && (
                <div className="px-5 py-4">
                  <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                    <AlertCircle size={14} className="flex-shrink-0" />
                    {activeConfig.error}
                  </div>
                </div>
              )}
              {!activeConfig.error && activeConfig.cogs.length === 0 && !activeConfig.loading && (
                <div className="px-5 py-8 text-center text-sm text-muted-foreground">Noch nicht geladen — klicke "Cogs laden"</div>
              )}
              {activeConfig.loading && (
                <div className="px-5 py-8 text-center text-sm text-muted-foreground">
                  <Loader size={16} className="animate-spin inline mr-2" />Cogs laden...
                </div>
              )}
              {!activeConfig.loading && activeConfig.cogs.length > 0 && (
                pluginView === 'list' ? (
                  <div className="divide-y divide-border">
                    {activeConfig.cogs.map((cog) => {
                      const filePath = cog.type === 'java'
                        ? `${activeConfig.botPath}/src/main/java/main/${cog.filename}`
                        : cog.type === 'nodejs'
                          ? `${activeConfig.botPath}/src/${cog.filename}`
                          : `${activeConfig.botPath}/cogs/${cog.filename}`
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
                          <button onClick={() => viewFile(activeConfig.serverId, filePath, cog.name)}
                            className="flex items-center gap-1 px-2 py-1 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                            <Eye size={13} /> Code
                          </button>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3 p-3">
                    {activeConfig.cogs.map((cog) => {
                      const filePath = cog.type === 'java'
                        ? `${activeConfig.botPath}/src/main/java/main/${cog.filename}`
                        : cog.type === 'nodejs'
                          ? `${activeConfig.botPath}/src/${cog.filename}`
                          : `${activeConfig.botPath}/cogs/${cog.filename}`
                      return (
                        <div key={cog.filename} className="bg-muted/30 border border-border rounded-lg p-3 flex flex-col gap-2 hover:bg-muted/50 transition-colors">
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                              cog.type === 'java' ? 'bg-orange-400' : cog.type === 'nodejs' ? 'bg-green-400' : 'bg-blue-400'
                            }`} />
                            <p className="text-sm font-medium text-foreground truncate">{cog.name}</p>
                          </div>
                          <p className="text-xs text-muted-foreground truncate">{cog.filename}</p>
                          <button onClick={() => viewFile(activeConfig.serverId, filePath, cog.name)}
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
          )}
        </div>
      </div>

      {/* Bot path modal */}
      {addBotPathModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h3 className="font-semibold text-foreground text-sm">Bot-Pfad — {addBotPathModal.botName}</h3>
              <button onClick={() => setAddBotPathModal(null)} className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"><X size={15} /></button>
            </div>
            <div className="px-5 py-4">
              <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Pfad auf dem Server</label>
              <input type="text" value={addPathValue} onChange={(e) => setAddPathValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && applyBotPath(addBotPathModal.botId, addPathValue)}
                placeholder="/root/MeinBot"
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-primary/50"
                autoFocus />
              <p className="mt-1.5 text-xs text-muted-foreground">Stammverzeichnis des Bots</p>
            </div>
            <div className="flex gap-2 px-5 pb-4 justify-end">
              <button onClick={() => setAddBotPathModal(null)} className="px-3 py-2 text-sm rounded-lg border border-border text-muted-foreground hover:bg-muted">Abbrechen</button>
              <button onClick={() => applyBotPath(addBotPathModal.botId, addPathValue)} className="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:opacity-90">Übernehmen & Laden</button>
            </div>
          </div>
        </div>
      )}

      {/* Plugin request modal */}
      {pluginRequestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card border border-border rounded-lg p-6 w-full max-w-md shadow-xl">
            <h3 className="text-base font-semibold mb-4">Anfrage senden</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Typ</label>
                <select value={requestForm.type} onChange={e => setRequestForm(prev => ({ ...prev, type: e.target.value }))}
                  className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary">
                  <option value="plugin_request">Plugin-Anfrage</option>
                  <option value="feature_request">Feature-Anfrage</option>
                  <option value="bug_report">Fehler melden</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Beschreibung</label>
                <textarea value={requestForm.description} onChange={e => setRequestForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Beschreibe deine Anfrage ausführlich..." rows={4}
                  className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary" />
              </div>
              {requestResult === 'success' && <p className="text-sm text-green-400">Anfrage erfolgreich eingereicht.</p>}
              {requestResult === 'error' && <p className="text-sm text-destructive">Fehler beim Einreichen.</p>}
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => { setPluginRequestModal(false); setRequestResult(null); setRequestForm({ type: 'plugin_request', description: '' }) }}
                className="px-4 py-2 rounded-md border border-border text-sm hover:bg-muted transition-colors">Abbrechen</button>
              <button onClick={submitPluginRequest} disabled={requestLoading || !requestForm.description.trim()}
                className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm hover:bg-primary/90 disabled:opacity-50 transition-colors">
                {requestLoading ? 'Sende...' : 'Anfrage senden'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* File viewer */}
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
