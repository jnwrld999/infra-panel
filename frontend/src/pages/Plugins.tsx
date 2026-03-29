import { useEffect, useState } from 'react'
import { Plus, RefreshCw, Eye, X, Loader, List, LayoutGrid, AlertCircle, MessageSquare, Layers, Send, Trash2, Power } from 'lucide-react'
import client from '@/api/client'
import { useUIStore } from '@/store/uiStore'
import { useAuthStore } from '@/store/authStore'

interface Plugin { name: string; filename: string; status: string; type: string }
interface Bot { id: number; name: string; server_id?: number; status?: string; restricted?: boolean }
interface BotCogConfig { botId: number; botName: string; serverId: number; botPath: string; cogs: Plugin[]; loading: boolean; error?: string | null }

interface EmbedField { name: string; value: string; inline: boolean }
interface EmbedData {
  title: string | null; description: string | null; color: number | null
  author: string | null; footer: string | null; image: string | null
  thumbnail: string | null; fields: EmbedField[]
}
const EMPTY_EMBED: EmbedData = { title: null, description: null, color: 0x5865f2, author: null, footer: null, image: null, thumbnail: null, fields: [] }

function colorToHex(c: number | null): string {
  if (!c) return '#5865f2'
  return '#' + c.toString(16).padStart(6, '0')
}

function EmbedPreview({ embed }: { embed: EmbedData }) {
  const borderColor = embed.color ? colorToHex(embed.color) : '#5865f2'
  const hasContent = embed.title || embed.description || embed.author || embed.footer || embed.image || embed.thumbnail || (embed.fields?.length ?? 0) > 0
  if (!hasContent) return <div className="text-xs text-muted-foreground text-center py-4">Keine Vorschau</div>
  return (
    <div className="rounded overflow-hidden max-w-lg" style={{ borderLeft: `4px solid ${borderColor}`, background: '#2b2d31' }}>
      <div className="p-3 space-y-1">
        {embed.author && <div className="text-xs font-semibold text-[#dbdee1]">{embed.author}</div>}
        {embed.title && <div className="font-semibold text-sm text-[#dbdee1]">{embed.title}</div>}
        {embed.description && <div className="text-xs text-[#dbdee1] whitespace-pre-wrap">{embed.description}</div>}
        {embed.fields && embed.fields.length > 0 && (
          <div className="grid gap-1 pt-1" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
            {embed.fields.map((f, i) => (
              <div key={i} style={{ gridColumn: f.inline ? 'span 1' : 'span 3' }}>
                {f.name && <div className="text-xs font-semibold text-[#dbdee1]">{f.name}</div>}
                {f.value && <div className="text-xs text-[#dbdee1]">{f.value}</div>}
              </div>
            ))}
          </div>
        )}
        {embed.image && <img src={embed.image} className="mt-2 rounded max-w-full" alt="" onError={(e) => (e.currentTarget.style.display = 'none')} />}
        {embed.footer && <div className="text-[10px] text-[#949ba4] pt-1">{embed.footer}</div>}
      </div>
    </div>
  )
}

const BOT_DEFAULT_PATHS: Record<number, string> = {
  1: '/root/Discord Bots/AxellottenTV',
  2: '/root/Discord Bots/GalaxycraftBots/GalaxycraftBot',
  3: '/root/Discord Bots/GalaxycraftBots/gc-bot',
  4: '/root/Discord Bots/GalaxycraftBots/TicketBot',
  5: '/root/Discord Bots/GalaxycraftBots/GalaxycraftVerify',
  6: '/root/Discord Bots/NovaBot',
  7: '/root/Discord Bots/BeardedBot',
  8: '/root/Discord Bots/Mursrtx-Bot',
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

  // Embed modal
  const [embedModal, setEmbedModal] = useState<{ botId: number; serverId: number; cog: Plugin; botPath: string } | null>(null)
  const [embeds, setEmbeds] = useState<EmbedData[]>([])
  const [embedsLoading, setEmbedsLoading] = useState(false)
  const [activeEmbedIdx, setActiveEmbedIdx] = useState(0)
  const [channelId, setChannelId] = useState('')
  const [messageId, setMessageId] = useState('')
  const [sendStatus, setSendStatus] = useState<'idle' | 'sending' | 'ok' | 'error'>('idle')
  const [sendError, setSendError] = useState('')

  const [togglingCog, setTogglingCog] = useState<Record<string, boolean>>({})
  const [pendingToggle, setPendingToggle] = useState<{
    config: BotCogConfig
    cog: Plugin
    enable: boolean
  } | null>(null)

  const toggleCog = (config: BotCogConfig, cog: Plugin) => {
    const key = `${config.botId}-${cog.filename}`
    const enable = cog.status === 'disabled'
    setTogglingCog(prev => ({ ...prev, [key]: true }))
    client.post(`/plugins/toggle-discord-cog?bot_id=${config.botId}&filename=${encodeURIComponent(cog.filename)}&enable=${enable}&bot_path=${encodeURIComponent(config.botPath)}`)
      .then(() => {
        // Update cog status locally
        setBotConfigs(prev => prev.map(c => c.botId !== config.botId ? c : {
          ...c,
          cogs: c.cogs.map(g => g.filename !== cog.filename ? g : {
            ...g,
            filename: enable
              ? g.filename.replace(/\.(py|js)\.disabled$/, '.$1')
              : g.filename + '.disabled',
            status: enable ? 'active' : 'disabled',
          })
        }))
      })
      .catch(() => {})
      .finally(() => setTogglingCog(prev => { const n = { ...prev }; delete n[key]; return n }))
  }

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
    const { prefetchedBots } = useAuthStore.getState()
    const source = Array.isArray(prefetchedBots) && prefetchedBots.length >= 0
      ? Promise.resolve({ data: prefetchedBots as unknown as Bot[] })
      : client.get<Bot[]>('/bots/')

    source.then((r) => {
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

  const openEmbedModal = (config: BotCogConfig, cog: Plugin) => {
    const filePath = cog.type === 'java'
      ? `${config.botPath}/src/main/java/main/${cog.filename}`
      : cog.type === 'nodejs'
        ? `${config.botPath}/src/${cog.filename}`
        : `${config.botPath}/cogs/${cog.filename}`
    setEmbedModal({ botId: config.botId, serverId: config.serverId, cog, botPath: config.botPath })
    setEmbeds([]); setEmbedsLoading(true); setActiveEmbedIdx(0)
    setChannelId(''); setMessageId(''); setSendStatus('idle'); setSendError('')
    client.get<EmbedData[]>(`/plugins/embeds?bot_id=${config.botId}&file_path=${encodeURIComponent(filePath)}`)
      .then((r) => setEmbeds(r.data.length > 0 ? r.data : [{ ...EMPTY_EMBED, fields: [] }]))
      .catch(() => setEmbeds([{ ...EMPTY_EMBED, fields: [] }]))
      .finally(() => setEmbedsLoading(false))
  }

  const updateEmbed = (idx: number, patch: Partial<EmbedData>) =>
    setEmbeds((prev) => prev.map((e, i) => i === idx ? { ...e, ...patch } : e))

  const updateField = (ei: number, fi: number, patch: Partial<EmbedField>) =>
    setEmbeds((prev) => prev.map((e, i) => i !== ei ? e : { ...e, fields: e.fields.map((f, j) => j !== fi ? f : { ...f, ...patch }) }))

  const addField = (ei: number) =>
    setEmbeds((prev) => prev.map((e, i) => i !== ei ? e : { ...e, fields: [...e.fields, { name: '', value: '', inline: false }] }))

  const removeField = (ei: number, fi: number) =>
    setEmbeds((prev) => prev.map((e, i) => i !== ei ? e : { ...e, fields: e.fields.filter((_, j) => j !== fi) }))

  const sendEmbed = () => {
    if (!embedModal || !channelId.trim()) return
    setSendStatus('sending'); setSendError('')
    const embed = embeds[activeEmbedIdx]
    client.post<{ message_id: string }>(`/bots/${embedModal.botId}/send-embed`, {
      embed: {
        ...(embed.title && { title: embed.title }),
        ...(embed.description && { description: embed.description }),
        ...(embed.color && { color: embed.color }),
        ...(embed.author && { author: embed.author }),
        ...(embed.footer && { footer: embed.footer }),
        ...(embed.image && { image: embed.image }),
        ...(embed.thumbnail && { thumbnail: embed.thumbnail }),
        ...(embed.fields?.length ? { fields: embed.fields } : {}),
      },
      channel_id: channelId.trim(),
      message_id: messageId.trim() || undefined,
    })
      .then((r) => { setSendStatus('ok'); setMessageId(r.data.message_id) })
      .catch((e) => { setSendStatus('error'); setSendError(e?.response?.data?.detail || 'Fehler') })
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
                              cog.status === 'disabled' ? 'bg-gray-500' :
                              cog.type === 'java' ? 'bg-orange-400' : cog.type === 'nodejs' ? 'bg-green-400' : 'bg-blue-400'
                            }`} />
                            <div className="min-w-0">
                              <p className={`text-sm font-medium truncate ${cog.status === 'disabled' ? 'text-muted-foreground line-through' : 'text-foreground'}`}>{cog.name}</p>
                              <p className="text-xs text-muted-foreground truncate">{cog.filename}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            {(cog.type === 'discord_cog' || cog.type === 'nodejs') && (
                              <button
                                onClick={() => setPendingToggle({ config: activeConfig, cog, enable: cog.status === 'disabled' })}
                                disabled={!!togglingCog[`${activeConfig.botId}-${cog.filename}`]}
                                className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs transition-colors ${
                                  cog.status === 'disabled'
                                    ? 'text-green-400 hover:bg-green-400/10'
                                    : 'text-yellow-400 hover:bg-yellow-400/10'
                                } disabled:opacity-50`}
                              >
                                {togglingCog[`${activeConfig.botId}-${cog.filename}`]
                                  ? <Loader size={12} className="animate-spin" />
                                  : cog.status === 'disabled' ? 'Aktivieren' : 'Deaktivieren'}
                              </button>
                            )}
                            <button onClick={() => viewFile(activeConfig.serverId, filePath, cog.name)}
                              className="flex items-center gap-1 px-2 py-1 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                              <Eye size={13} /> Code
                            </button>
                            <button onClick={() => openEmbedModal(activeConfig, cog)}
                              className="flex items-center gap-1 px-2 py-1 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                              <Layers size={13} /> Embed
                            </button>
                          </div>
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
                              cog.status === 'disabled' ? 'bg-gray-500' :
                              cog.type === 'java' ? 'bg-orange-400' : cog.type === 'nodejs' ? 'bg-green-400' : 'bg-blue-400'
                            }`} />
                            <p className={`text-sm font-medium truncate ${cog.status === 'disabled' ? 'text-muted-foreground line-through' : 'text-foreground'}`}>{cog.name}</p>
                          </div>
                          <p className="text-xs text-muted-foreground truncate">{cog.filename}</p>
                          <div className="flex items-center gap-1">
                            {(cog.type === 'discord_cog' || cog.type === 'nodejs') && (
                              <button
                                onClick={() => setPendingToggle({ config: activeConfig, cog, enable: cog.status === 'disabled' })}
                                disabled={!!togglingCog[`${activeConfig.botId}-${cog.filename}`]}
                                className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs transition-colors ${
                                  cog.status === 'disabled'
                                    ? 'text-green-400 hover:bg-green-400/10'
                                    : 'text-yellow-400 hover:bg-yellow-400/10'
                                } disabled:opacity-50`}
                              >
                                {togglingCog[`${activeConfig.botId}-${cog.filename}`]
                                  ? <Loader size={12} className="animate-spin" />
                                  : cog.status === 'disabled' ? 'Aktivieren' : 'Deaktivieren'}
                              </button>
                            )}
                            <button onClick={() => viewFile(activeConfig.serverId, filePath, cog.name)}
                              className="flex items-center gap-1 px-2 py-1 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                              <Eye size={13} /> Code
                            </button>
                            <button onClick={() => openEmbedModal(activeConfig, cog)}
                              className="flex items-center gap-1 px-2 py-1 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                              <Layers size={13} /> Embed
                            </button>
                          </div>
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

      {/* Embed modal */}
      {embedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
              <div>
                <h3 className="font-semibold text-foreground text-sm">Embeds — {embedModal.cog.name}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{embedModal.cog.filename}</p>
              </div>
              <button onClick={() => setEmbedModal(null)} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"><X size={16} /></button>
            </div>
            <div className="flex-1 overflow-auto p-5 min-h-0 space-y-4">
              {embedsLoading && <div className="text-center text-sm text-muted-foreground py-6"><Loader size={16} className="animate-spin inline mr-2" />Lädt Embeds...</div>}
              {!embedsLoading && embeds.length === 0 && <div className="text-center text-sm text-muted-foreground py-6">Keine Embeds gefunden</div>}
              {!embedsLoading && embeds.length > 0 && (
                <>
                  {embeds.length > 1 && (
                    <div className="flex gap-1 flex-wrap">
                      {embeds.map((_, i) => (
                        <button key={i} onClick={() => setActiveEmbedIdx(i)}
                          className={`px-2 py-1 rounded text-xs border transition-colors ${i === activeEmbedIdx ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted'}`}>
                          Embed {i + 1}
                        </button>
                      ))}
                    </div>
                  )}
                  {/* Embed editor */}
                  {embeds[activeEmbedIdx] && (() => {
                    const e = embeds[activeEmbedIdx]
                    const update = (p: Partial<EmbedData>) => updateEmbed(activeEmbedIdx, p)
                    const inputCls = "w-full bg-muted border border-border rounded px-2 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    return (
                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <input type="color" value={colorToHex(e.color)} onChange={ev => update({ color: parseInt(ev.target.value.slice(1), 16) })}
                              className="w-8 h-8 rounded border border-border bg-muted cursor-pointer flex-shrink-0" />
                            <input className={inputCls} placeholder="Titel" value={e.title ?? ''} onChange={ev => update({ title: ev.target.value || null })} />
                          </div>
                          <textarea className={`${inputCls} resize-none`} rows={3} placeholder="Beschreibung" value={e.description ?? ''} onChange={ev => update({ description: ev.target.value || null })} />
                          <input className={inputCls} placeholder="Author" value={e.author ?? ''} onChange={ev => update({ author: ev.target.value || null })} />
                          <input className={inputCls} placeholder="Footer" value={e.footer ?? ''} onChange={ev => update({ footer: ev.target.value || null })} />
                          <input className={inputCls} placeholder="Bild URL" value={e.image ?? ''} onChange={ev => update({ image: ev.target.value || null })} />
                          <input className={inputCls} placeholder="Thumbnail URL" value={e.thumbnail ?? ''} onChange={ev => update({ thumbnail: ev.target.value || null })} />
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-medium text-muted-foreground">Fields</span>
                              <button onClick={() => addField(activeEmbedIdx)} className="text-xs text-primary hover:underline">+ hinzufügen</button>
                            </div>
                            {(e.fields ?? []).map((f, fi) => (
                              <div key={fi} className="flex gap-1 mb-1 items-center">
                                <input className="flex-1 bg-muted border border-border rounded px-2 py-1 text-xs text-foreground focus:outline-none" placeholder="Name" value={f.name} onChange={ev => updateField(activeEmbedIdx, fi, { name: ev.target.value })} />
                                <input className="flex-1 bg-muted border border-border rounded px-2 py-1 text-xs text-foreground focus:outline-none" placeholder="Value" value={f.value} onChange={ev => updateField(activeEmbedIdx, fi, { value: ev.target.value })} />
                                <button onClick={() => removeField(activeEmbedIdx, fi)} className="p-1 text-muted-foreground hover:text-red-400"><Trash2 size={12} /></button>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="space-y-3">
                          <p className="text-xs font-medium text-muted-foreground">Vorschau</p>
                          <EmbedPreview embed={e} />
                          <div className="pt-2 space-y-2 border-t border-border">
                            <p className="text-xs font-medium text-muted-foreground flex items-center gap-1"><Send size={11} /> Senden</p>
                            <input className={inputCls + ' font-mono'} placeholder="Kanal ID" value={channelId} onChange={ev => setChannelId(ev.target.value.trim())} />
                            <input className={inputCls + ' font-mono'} placeholder="Nachricht ID (optional, zum Bearbeiten)" value={messageId} onChange={ev => setMessageId(ev.target.value.trim())} />
                            {sendStatus === 'ok' && <p className="text-xs text-green-400">{messageId ? 'Embed bearbeitet!' : 'Embed gesendet!'}</p>}
                            {sendStatus === 'error' && <p className="text-xs text-red-400">{sendError}</p>}
                            <button onClick={sendEmbed} disabled={sendStatus === 'sending' || !channelId.trim()}
                              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors">
                              <Send size={14} />
                              {sendStatus === 'sending' ? 'Sendet...' : messageId ? 'Embed bearbeiten' : 'Embed senden'}
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })()}
                </>
              )}
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

      {/* Toggle confirmation modal */}
      {pendingToggle && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setPendingToggle(null)}
        >
          <div
            className="bg-card border border-border rounded-xl w-full max-w-sm mx-4 p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-yellow-500/10 flex items-center justify-center flex-shrink-0">
                <AlertCircle size={16} className="text-yellow-400" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">
                  {pendingToggle.enable ? 'Cog aktivieren?' : 'Cog deaktivieren?'}
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  <span className="font-medium text-foreground">{pendingToggle.cog.name}</span>
                  {pendingToggle.enable
                    ? ' wird beim nächsten Bot-Neustart geladen.'
                    : ' wird deaktiviert und beim nächsten Bot-Neustart nicht mehr geladen.'}
                </p>
                <p className="text-xs text-yellow-400 mt-2">
                  Der Bot muss neu gestartet werden, damit die Änderung wirksam wird.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  await toggleCog(pendingToggle.config, pendingToggle.cog)
                  setPendingToggle(null)
                }}
                disabled={togglingCog !== null && Object.keys(togglingCog).length > 0}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
                  pendingToggle.enable
                    ? 'bg-green-500/10 border border-green-500/30 text-green-400 hover:bg-green-500/20'
                    : 'bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/20'
                }`}
              >
                {Object.keys(togglingCog).length > 0 ? 'Bitte warten...' : (pendingToggle.enable ? 'Aktivieren' : 'Deaktivieren')}
              </button>
              <button
                onClick={() => setPendingToggle(null)}
                disabled={Object.keys(togglingCog).length > 0}
                className="flex-1 py-2 rounded-lg text-sm font-medium bg-muted border border-border text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
              >
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
