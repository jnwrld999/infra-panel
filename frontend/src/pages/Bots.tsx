import { useEffect, useState } from 'react'
import { Plus, RefreshCw, Eye, EyeOff, Copy, X, Loader, ChevronDown, ChevronRight, MessageSquare, Pencil, Check, Layers } from 'lucide-react'
import { StatusBadge } from '@/components/StatusBadge'
import { useAuthStore } from '@/store/authStore'
import client from '@/api/client'
import { useUIStore } from '@/store/uiStore'

interface Bot {
  id: number
  name: string
  status?: string
  server_id?: number
  type?: string
  description?: string
  restricted?: boolean
}

interface Plugin { name: string; filename: string; status: string; type: string }

interface EmbedField { name: string; value: string; inline: boolean }
interface EmbedData {
  title: string | null
  description: string | null
  color: number | null
  author: string | null
  footer: string | null
  image: string | null
  thumbnail: string | null
  fields: EmbedField[]
}

const EMPTY_EMBED: EmbedData = {
  title: null, description: null, color: null, author: null,
  footer: null, image: null, thumbnail: null, fields: [],
}

function colorToHex(color: number | null): string {
  if (color === null) return ''
  return '#' + color.toString(16).padStart(6, '0')
}

function hexToColor(hex: string): number | null {
  const clean = hex.replace('#', '')
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return null
  return parseInt(clean, 16)
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
function getBotPath(botId: number): string {
  try {
    const saved = JSON.parse(localStorage.getItem(PATHS_KEY) || '{}')
    return saved[`bot_${botId}`] || BOT_DEFAULT_PATHS[botId] || `/root/Discord Bots/${botId}`
  } catch {
    return BOT_DEFAULT_PATHS[botId] || `/root/Discord Bots/${botId}`
  }
}

function cogFilePath(botId: number, cog: Plugin): string {
  const base = getBotPath(botId)
  if (cog.type === 'java') return `${base}/src/main/java/main/${cog.filename}`
  if (cog.type === 'nodejs') return `${base}/src/${cog.filename}`
  return `${base}/cogs/${cog.filename}`
}

interface BotCreate {
  name: string
  server_id: number | ''
  token: string
  type: string
  description: string
}

interface Server { id: number; name: string }

function EmbedPreview({ embed }: { embed: EmbedData }) {
  const borderColor = embed.color ? colorToHex(embed.color) : '#5865f2'

  return (
    <div className="rounded-lg p-2" style={{ backgroundColor: '#1e1f22' }}>
      <div
        className="rounded overflow-hidden relative"
        style={{ borderLeft: `4px solid ${borderColor}`, backgroundColor: '#2b2d31' }}
      >
        {embed.thumbnail && (
          <img
            src={embed.thumbnail}
            alt=""
            className="absolute top-3 right-3 w-16 h-16 rounded object-cover"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
        )}
        <div className={`p-3 ${embed.thumbnail ? 'pr-20' : ''}`}>
          {embed.author && (
            <p className="text-xs mb-1" style={{ color: '#b5bac1' }}>{embed.author}</p>
          )}
          {embed.title && (
            <p className="text-sm font-bold mb-1 text-white">{embed.title}</p>
          )}
          {embed.description && (
            <p className="text-xs mb-2 whitespace-pre-wrap" style={{ color: '#dbdee1' }}>
              {embed.description}
            </p>
          )}
          {embed.fields.length > 0 && (
            <div className="grid grid-cols-3 gap-x-4 gap-y-2 mb-2">
              {embed.fields.map((f, i) => (
                <div key={i} className={f.inline ? '' : 'col-span-3'}>
                  <p className="text-xs font-bold text-white">{f.name || '\u200b'}</p>
                  <p className="text-xs" style={{ color: '#dbdee1' }}>{f.value || '\u200b'}</p>
                </div>
              ))}
            </div>
          )}
          {embed.image && (
            <img
              src={embed.image}
              alt=""
              className="w-full rounded mt-2 max-h-48 object-cover"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
          )}
          {embed.footer && (
            <p className="text-xs mt-2" style={{ color: '#949ba4' }}>{embed.footer}</p>
          )}
          {!embed.title && !embed.description && !embed.author && embed.fields.length === 0 && !embed.footer && (
            <p className="text-xs italic" style={{ color: '#949ba4' }}>Vorschau erscheint hier…</p>
          )}
        </div>
      </div>
    </div>
  )
}

export default function Bots() {
  const { user } = useAuthStore()
  const previewUser = (useUIStore as any)((s: any) => s.previewUser) ?? null
  const effectiveUser = previewUser ?? user
  const isBotOwner = effectiveUser?.role === 'bot_owner'
  const assignedBotId = (effectiveUser as any)?.assigned_bot?.id as number | undefined
  const [bots, setBots] = useState<Bot[]>([])
  const [servers, setServers] = useState<Server[]>([])
  const [tokens, setTokens] = useState<Record<number, string>>({})
  const [tokenRevealed, setTokenRevealed] = useState<Record<number, boolean>>({})
  const [expanded, setExpanded] = useState<Record<number, boolean>>({})
  const [cogs, setCogs] = useState<Record<number, Plugin[]>>({})
  const [cogsLoading, setCogsLoading] = useState<Record<number, boolean>>({})
  const [fileViewer, setFileViewer] = useState<{ serverId: number; path: string; content: string; name: string } | null>(null)
  const [addModal, setAddModal] = useState(false)
  const [addForm, setAddForm] = useState<BotCreate>({ name: '', server_id: '', token: '', type: 'discord', description: '' })
  const [addLoading, setAddLoading] = useState(false)
  const [addError, setAddError] = useState('')
  const [requestModal, setRequestModal] = useState(false)
  const [requestForm, setRequestForm] = useState({ type: 'feature_request', description: '' })
  const [requestLoading, setRequestLoading] = useState(false)
  const [requestResult, setRequestResult] = useState<'success' | 'error' | null>(null)
  const [editingName, setEditingName] = useState<Record<number, string | null>>({})
  const [nameSaving, setNameSaving] = useState<Record<number, boolean>>({})
  const [embedModal, setEmbedModal] = useState<{ bot: Bot; cog: Plugin } | null>(null)
  const [embeds, setEmbeds] = useState<EmbedData[]>([])
  const [embedsLoading, setEmbedsLoading] = useState(false)
  const [activeEmbedIdx, setActiveEmbedIdx] = useState(0)
  const [channelId, setChannelId] = useState('')
  const [messageId, setMessageId] = useState('')
  const [sendStatus, setSendStatus] = useState<'idle' | 'sending' | 'ok' | 'error'>('idle')
  const [sendError, setSendError] = useState('')

  const visibleBots = isBotOwner && assignedBotId
    ? bots.filter((b) => b.id === assignedBotId)
    : bots

  useEffect(() => {
    client.get<Bot[]>('/bots/').then((r) => {
      setBots(r.data)
      useUIStore.getState().setLastReload(new Date())
    }).catch(() => {})
    client.get<Server[]>('/servers/').then((r) => setServers(r.data)).catch(() => {})
  }, [])

  const showToken = (id: number) => {
    if (tokens[id]) {
      setTokenRevealed(prev => ({ ...prev, [id]: !prev[id] }))
      return
    }
    client.get(`/bots/${id}/token`)
      .then((r) => {
        setTokens((prev) => ({ ...prev, [id]: r.data.token }))
        setTokenRevealed(prev => ({ ...prev, [id]: true }))
      })
      .catch(() => {})
  }

  const revealToken = (id: number) => {
    setTokenRevealed(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const copyToken = (id: number) => {
    if (tokens[id]) navigator.clipboard.writeText(tokens[id])
  }

  const toggleExpand = (bot: Bot) => {
    const next = !expanded[bot.id]
    setExpanded((prev) => ({ ...prev, [bot.id]: next }))
    if (next && !cogs[bot.id] && !bot.restricted) {
      loadCogs(bot.id)
    }
  }

  const loadCogs = (botId: number) => {
    setCogsLoading((prev) => ({ ...prev, [botId]: true }))
    const botPath = getBotPath(botId)
    client.get<Plugin[]>(`/plugins/discord-bot/${botId}?bot_path=${encodeURIComponent(botPath)}`)
      .then((r) => setCogs((prev) => ({ ...prev, [botId]: r.data })))
      .catch(() => setCogs((prev) => ({ ...prev, [botId]: [] })))
      .finally(() => setCogsLoading((prev) => ({ ...prev, [botId]: false })))
  }

  const viewFile = (serverId: number, path: string, name: string) => {
    client.get<{ content: string }>(`/plugins/read-file?server_id=${serverId}&path=${encodeURIComponent(path)}`)
      .then((r) => setFileViewer({ serverId, path, content: r.data.content, name }))
      .catch(() => setFileViewer({ serverId, path, content: '(Datei konnte nicht geladen werden)', name }))
  }

  const submitRequest = () => {
    if (!requestForm.description.trim()) return
    setRequestLoading(true)
    setRequestResult(null)
    client.post('/approvals/', {
      type: requestForm.type,
      payload: { description: requestForm.description.trim() },
    })
      .then(() => {
        setRequestResult('success')
        setTimeout(() => {
          setRequestModal(false)
          setRequestResult(null)
          setRequestForm({ type: 'feature_request', description: '' })
        }, 1500)
      })
      .catch(() => setRequestResult('error'))
      .finally(() => setRequestLoading(false))
  }

  const startEditName = (bot: Bot) => {
    setEditingName((prev) => ({ ...prev, [bot.id]: bot.name }))
  }

  const cancelEditName = (id: number) => {
    setEditingName((prev) => { const n = { ...prev }; delete n[id]; return n })
  }

  const saveEditName = (id: number) => {
    const name = editingName[id]?.trim()
    if (!name) return
    setNameSaving((prev) => ({ ...prev, [id]: true }))
    client.patch(`/bots/${id}`, { name })
      .then((r) => {
        setBots((prev) => prev.map((b) => b.id === id ? { ...b, name: r.data.name } : b))
        cancelEditName(id)
      })
      .catch(() => {})
      .finally(() => setNameSaving((prev) => { const n = { ...prev }; delete n[id]; return n }))
  }

  const openEmbedModal = (bot: Bot, cog: Plugin) => {
    setEmbedModal({ bot, cog })
    setEmbeds([])
    setEmbedsLoading(true)
    setActiveEmbedIdx(0)
    setChannelId('')
    setMessageId('')
    setSendStatus('idle')
    setSendError('')
    const filePath = cogFilePath(bot.id, cog)
    client.get<EmbedData[]>(`/plugins/embeds?bot_id=${bot.id}&file_path=${encodeURIComponent(filePath)}`)
      .then((r) => setEmbeds(r.data.length > 0 ? r.data : [{ ...EMPTY_EMBED, fields: [] }]))
      .catch(() => setEmbeds([{ ...EMPTY_EMBED, fields: [] }]))
      .finally(() => setEmbedsLoading(false))
  }

  const updateEmbed = (idx: number, patch: Partial<EmbedData>) => {
    setEmbeds((prev) => prev.map((e, i) => i === idx ? { ...e, ...patch } : e))
  }

  const updateEmbedField = (embedIdx: number, fieldIdx: number, patch: Partial<EmbedField>) => {
    setEmbeds((prev) => prev.map((e, i) => {
      if (i !== embedIdx) return e
      return { ...e, fields: e.fields.map((f, fi) => fi === fieldIdx ? { ...f, ...patch } : f) }
    }))
  }

  const addEmbedField = (embedIdx: number) => {
    setEmbeds((prev) => prev.map((e, i) =>
      i === embedIdx ? { ...e, fields: [...e.fields, { name: '', value: '', inline: false }] } : e
    ))
  }

  const removeEmbedField = (embedIdx: number, fieldIdx: number) => {
    setEmbeds((prev) => prev.map((e, i) =>
      i === embedIdx ? { ...e, fields: e.fields.filter((_, fi) => fi !== fieldIdx) } : e
    ))
  }

  const sendEmbed = () => {
    if (!embedModal || !channelId.trim()) return
    setSendStatus('sending')
    setSendError('')
    client.post(`/bots/${embedModal.bot.id}/send-embed`, {
      embed: embeds[activeEmbedIdx],
      channel_id: channelId.trim(),
      message_id: messageId.trim() || null,
    })
      .then(() => setSendStatus('ok'))
      .catch((e) => {
        setSendStatus('error')
        setSendError(e?.response?.data?.detail || 'Fehler beim Senden.')
      })
  }

  const submitAdd = () => {
    if (!addForm.name || !addForm.token || !addForm.server_id) {
      setAddError('Name, Server und Token sind erforderlich.')
      return
    }
    setAddLoading(true)
    setAddError('')
    client.post<Bot>('/bots/', {
      name: addForm.name,
      server_id: Number(addForm.server_id),
      token: addForm.token,
      type: addForm.type,
      description: addForm.description || undefined,
    }).then((r) => {
      setBots((prev) => [...prev, r.data])
      setAddModal(false)
      setAddForm({ name: '', server_id: '', token: '', type: 'discord', description: '' })
    }).catch((e) => {
      setAddError(e?.response?.data?.detail || 'Fehler beim Erstellen.')
    }).finally(() => setAddLoading(false))
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-foreground">Bots</h2>
        {user?.is_owner && !isBotOwner && (
          <button onClick={() => { setAddModal(true); setAddError('') }}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm hover:opacity-90 transition-opacity">
            <Plus size={14} /> Bot hinzufügen
          </button>
        )}
      </div>

      {/* Feature Request Banner */}
      {!isBotOwner && <div className="bg-primary/10 border border-primary/20 rounded-lg px-4 py-3 flex items-start justify-between gap-4 mb-4">
        <div className="flex items-start gap-3">
          <MessageSquare size={18} className="text-primary mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-foreground">Feature & Plugin Anfragen</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Wünsche für neue Plugins, Features oder Änderungen können direkt hier eingereicht werden.
              Du erhältst eine Discord-DM, sobald deine Anfrage bearbeitet wurde.
            </p>
          </div>
        </div>
        <button
          onClick={() => setRequestModal(true)}
          className="flex-shrink-0 px-3 py-1.5 bg-primary text-primary-foreground text-xs rounded-md hover:bg-primary/90 transition-colors"
        >
          Anfrage senden
        </button>
      </div>}

      <div className="space-y-4">
        {visibleBots.map((bot) => (
          <div key={bot.id} className="bg-card border border-border rounded-xl overflow-hidden">
            {/* Bot header */}
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-3">
                <button onClick={() => !bot.restricted && toggleExpand(bot)}
                  className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
                  disabled={!!bot.restricted}>
                  {expanded[bot.id] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>
                <div>
                  <div className="flex items-center gap-2">
                    {editingName[bot.id] !== undefined ? (
                      <>
                        <input
                          autoFocus
                          value={editingName[bot.id] ?? ''}
                          onChange={(e) => setEditingName((prev) => ({ ...prev, [bot.id]: e.target.value }))}
                          onKeyDown={(e) => { if (e.key === 'Enter') saveEditName(bot.id); if (e.key === 'Escape') cancelEditName(bot.id) }}
                          className="font-semibold bg-background border border-primary/50 rounded px-2 py-0.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 w-36"
                        />
                        <button onClick={() => saveEditName(bot.id)} disabled={nameSaving[bot.id]}
                          className="p-1 rounded text-green-400 hover:bg-green-400/10 transition-colors disabled:opacity-50">
                          <Check size={13} />
                        </button>
                        <button onClick={() => cancelEditName(bot.id)}
                          className="p-1 rounded text-muted-foreground hover:bg-muted transition-colors">
                          <X size={13} />
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="font-semibold text-foreground">{bot.name}</span>
                        {!bot.restricted && (user?.is_owner || user?.role === 'owner' || user?.role === 'admin' || user?.role === 'bot_owner') && (
                          <button onClick={() => startEditName(bot)} title="Name bearbeiten"
                            className="p-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                            <Pencil size={11} />
                          </button>
                        )}
                        {!bot.restricted && bot.status && <StatusBadge status={bot.status} />}
                        {bot.type && <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{bot.type}</span>}
                      </>
                    )}
                  </div>
                  {bot.description && <p className="text-xs text-muted-foreground mt-0.5">{bot.description}</p>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {bot.restricted ? (
                  <span className="text-yellow-400 text-sm font-medium">Bot nicht verfügbar</span>
                ) : (
                  <>
                    {(user?.is_owner || user?.role === 'owner' || user?.role === 'admin' || user?.role === 'bot_owner') && (
                      <button onClick={() => showToken(bot.id)}
                        className="px-3 py-1.5 text-xs bg-muted border border-border rounded-md text-foreground hover:bg-border transition-colors">
                        Token anzeigen
                      </button>
                    )}
                    {!bot.restricted && (
                      <button onClick={() => loadCogs(bot.id)}
                        disabled={cogsLoading[bot.id]}
                        className="flex items-center gap-1 px-2 py-1.5 text-xs rounded-md text-primary hover:bg-primary/10 transition-colors border border-primary/30 disabled:opacity-50">
                        {cogsLoading[bot.id] ? <Loader size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                        Cogs
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Token display */}
            {tokens[bot.id] && (
              <div className="mx-5 mb-3 flex items-center gap-2 p-2 rounded bg-muted border border-border text-xs font-mono">
                <span className="flex-1 text-green-400 break-all">
                  {tokenRevealed[bot.id] ? tokens[bot.id] : '•'.repeat(Math.min(tokens[bot.id].length, 40))}
                </span>
                <button onClick={() => revealToken(bot.id)} title={tokenRevealed[bot.id] ? 'Verbergen' : 'Anzeigen'}
                  className="flex-shrink-0 p-1 rounded hover:bg-border transition-colors text-muted-foreground hover:text-foreground">
                  {tokenRevealed[bot.id] ? <EyeOff size={12} /> : <Eye size={12} />}
                </button>
                <button onClick={() => copyToken(bot.id)} title="Kopieren"
                  className="flex-shrink-0 p-1 rounded hover:bg-border transition-colors text-muted-foreground hover:text-foreground">
                  <Copy size={12} />
                </button>
              </div>
            )}

            {/* Cogs section */}
            {expanded[bot.id] && !bot.restricted && (
              <div className="border-t border-border">
                {cogsLoading[bot.id] && (
                  <div className="px-5 py-6 text-center text-sm text-muted-foreground">
                    <Loader size={16} className="animate-spin inline mr-2" />Lädt...
                  </div>
                )}
                {!cogsLoading[bot.id] && (!cogs[bot.id] || cogs[bot.id].length === 0) && (
                  <div className="px-5 py-6 text-center text-sm text-muted-foreground">
                    Keine Cogs gefunden.
                  </div>
                )}
                {!cogsLoading[bot.id] && cogs[bot.id] && cogs[bot.id].length > 0 && (
                  <div className="divide-y divide-border">
                    {cogs[bot.id].map((cog) => {
                      const filePath = cogFilePath(bot.id, cog)
                      return (
                        <div key={cog.filename} className="flex items-center justify-between px-5 py-2.5 hover:bg-muted/20 transition-colors">
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-blue-400" />
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">{cog.name}</p>
                              <p className="text-xs text-muted-foreground truncate">{cog.filename}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            {bot.server_id && (
                              <button onClick={() => viewFile(bot.server_id!, filePath, cog.name)}
                                className="flex items-center gap-1 px-2 py-1 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                                <Eye size={13} /> Code
                              </button>
                            )}
                            <button onClick={() => openEmbedModal(bot, cog)}
                              className="flex items-center gap-1 px-2 py-1 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                              <Layers size={13} /> Embeds
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
        {visibleBots.length === 0 && (
          <p className="text-muted-foreground text-sm">Keine Bots konfiguriert.</p>
        )}
      </div>

      {/* Add bot modal */}
      {addModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h3 className="font-semibold text-foreground text-sm">Bot hinzufügen</h3>
              <button onClick={() => setAddModal(false)} className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"><X size={15} /></button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Name *</label>
                <input type="text" value={addForm.name} onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="AxellottenTV"
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Server *</label>
                <select value={addForm.server_id} onChange={(e) => setAddForm((f) => ({ ...f, server_id: e.target.value ? Number(e.target.value) : '' }))}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50">
                  <option value="">Server wählen...</option>
                  {servers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Token *</label>
                <input type="password" value={addForm.token} onChange={(e) => setAddForm((f) => ({ ...f, token: e.target.value }))}
                  placeholder="Bot-Token"
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Typ</label>
                <select value={addForm.type} onChange={(e) => setAddForm((f) => ({ ...f, type: e.target.value }))}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50">
                  <option value="discord">Discord</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Beschreibung</label>
                <input type="text" value={addForm.description} onChange={(e) => setAddForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Optionale Beschreibung"
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
              </div>
              {addError && <p className="text-xs text-red-400">{addError}</p>}
            </div>
            <div className="flex gap-2 px-5 pb-4 justify-end">
              <button onClick={() => setAddModal(false)} className="px-3 py-2 text-sm rounded-lg border border-border text-muted-foreground hover:bg-muted">Abbrechen</button>
              <button onClick={submitAdd} disabled={addLoading}
                className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50">
                {addLoading && <Loader size={13} className="animate-spin" />}
                Hinzufügen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Request modal */}
      {requestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card border border-border rounded-lg p-6 w-full max-w-md shadow-xl">
            <h3 className="text-base font-semibold mb-4">Anfrage senden</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Typ</label>
                <select
                  value={requestForm.type}
                  onChange={e => setRequestForm(prev => ({ ...prev, type: e.target.value }))}
                  className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="feature_request">Feature-Anfrage</option>
                  <option value="plugin_request">Plugin-Anfrage</option>
                  <option value="bug_report">Fehler melden</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Beschreibung</label>
                <textarea
                  value={requestForm.description}
                  onChange={e => setRequestForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Beschreibe deine Anfrage ausführlich..."
                  rows={4}
                  className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              {requestResult === 'success' && (
                <p className="text-sm text-green-400">Anfrage erfolgreich eingereicht.</p>
              )}
              {requestResult === 'error' && (
                <p className="text-sm text-destructive">Fehler beim Einreichen der Anfrage.</p>
              )}
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => { setRequestModal(false); setRequestResult(null); setRequestForm({ type: 'feature_request', description: '' }) }}
                className="px-4 py-2 rounded-md border border-border text-sm hover:bg-muted transition-colors"
              >
                Abbrechen
              </button>
              <button
                onClick={submitRequest}
                disabled={requestLoading || !requestForm.description.trim()}
                className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {requestLoading ? 'Sende...' : 'Anfrage senden'}
              </button>
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

      {/* Embed modal */}
      {embedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
              <div>
                <h3 className="font-semibold text-foreground text-sm">
                  Embeds — {embedModal.cog.name}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">{embedModal.bot.name}</p>
              </div>
              <button
                onClick={() => setEmbedModal(null)}
                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                <X size={16} />
              </button>
            </div>

            {embedsLoading ? (
              <div className="flex-1 flex items-center justify-center py-12">
                <Loader size={20} className="animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="flex-1 overflow-hidden flex flex-col min-h-0">
                {/* Tabs if multiple embeds */}
                {embeds.length > 1 && (
                  <div className="flex gap-1 px-5 pt-3 flex-shrink-0 border-b border-border">
                    {embeds.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setActiveEmbedIdx(i)}
                        className={`px-3 py-1.5 text-xs rounded-t-md transition-colors ${
                          activeEmbedIdx === i
                            ? 'bg-primary/10 text-primary border border-primary/30 border-b-0'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        Embed {i + 1}
                      </button>
                    ))}
                  </div>
                )}

                {/* Two-column layout */}
                <div className="flex-1 overflow-hidden flex min-h-0">
                  {/* Left: Editor */}
                  <div className="flex-1 overflow-y-auto p-4 border-r border-border space-y-3">
                    {embeds[activeEmbedIdx] && (
                      <>
                        <div>
                          <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Titel</label>
                          <input
                            type="text"
                            value={embeds[activeEmbedIdx].title ?? ''}
                            onChange={(e) => updateEmbed(activeEmbedIdx, { title: e.target.value || null })}
                            placeholder="Embed-Titel"
                            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Beschreibung</label>
                          <textarea
                            value={embeds[activeEmbedIdx].description ?? ''}
                            onChange={(e) => updateEmbed(activeEmbedIdx, { description: e.target.value || null })}
                            placeholder="Embed-Beschreibung"
                            rows={3}
                            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Farbe</label>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={colorToHex(embeds[activeEmbedIdx].color)}
                              onChange={(e) => updateEmbed(activeEmbedIdx, { color: hexToColor(e.target.value) })}
                              placeholder="#5865f2"
                              maxLength={7}
                              className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 font-mono"
                            />
                            <input
                              type="color"
                              value={colorToHex(embeds[activeEmbedIdx].color) || '#5865f2'}
                              onChange={(e) => updateEmbed(activeEmbedIdx, { color: hexToColor(e.target.value) })}
                              className="w-10 h-10 rounded-lg border border-border cursor-pointer bg-background p-0.5"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Autor</label>
                          <input
                            type="text"
                            value={embeds[activeEmbedIdx].author ?? ''}
                            onChange={(e) => updateEmbed(activeEmbedIdx, { author: e.target.value || null })}
                            placeholder="Autor-Name"
                            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Footer</label>
                          <input
                            type="text"
                            value={embeds[activeEmbedIdx].footer ?? ''}
                            onChange={(e) => updateEmbed(activeEmbedIdx, { footer: e.target.value || null })}
                            placeholder="Footer-Text"
                            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Thumbnail URL</label>
                          <input
                            type="text"
                            value={embeds[activeEmbedIdx].thumbnail ?? ''}
                            onChange={(e) => updateEmbed(activeEmbedIdx, { thumbnail: e.target.value || null })}
                            placeholder="https://..."
                            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Bild URL</label>
                          <input
                            type="text"
                            value={embeds[activeEmbedIdx].image ?? ''}
                            onChange={(e) => updateEmbed(activeEmbedIdx, { image: e.target.value || null })}
                            placeholder="https://..."
                            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                          />
                        </div>

                        {/* Fields */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wide">Felder</label>
                            <button
                              onClick={() => addEmbedField(activeEmbedIdx)}
                              className="text-xs text-primary hover:text-primary/80 transition-colors"
                            >
                              + Feld hinzufügen
                            </button>
                          </div>
                          <div className="space-y-2">
                            {embeds[activeEmbedIdx].fields.map((field, fi) => (
                              <div key={fi} className="border border-border rounded-lg p-2 space-y-2 bg-muted/10">
                                <div className="flex gap-2">
                                  <input
                                    type="text"
                                    value={field.name}
                                    onChange={(e) => updateEmbedField(activeEmbedIdx, fi, { name: e.target.value })}
                                    placeholder="Feldname"
                                    className="flex-1 bg-background border border-border rounded px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                                  />
                                  <button
                                    onClick={() => removeEmbedField(activeEmbedIdx, fi)}
                                    className="p-1.5 rounded text-muted-foreground hover:text-red-400 hover:bg-red-400/10 transition-colors"
                                  >
                                    <X size={12} />
                                  </button>
                                </div>
                                <input
                                  type="text"
                                  value={field.value}
                                  onChange={(e) => updateEmbedField(activeEmbedIdx, fi, { value: e.target.value })}
                                  placeholder="Feldwert"
                                  className="w-full bg-background border border-border rounded px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                                />
                                <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
                                  <input
                                    type="checkbox"
                                    checked={field.inline}
                                    onChange={(e) => updateEmbedField(activeEmbedIdx, fi, { inline: e.target.checked })}
                                    className="rounded"
                                  />
                                  Inline
                                </label>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Send section */}
                        <div className="border-t border-border pt-3 space-y-2">
                          <div>
                            <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Channel ID *</label>
                            <input
                              type="text"
                              value={channelId}
                              onChange={(e) => { setChannelId(e.target.value); setSendStatus('idle') }}
                              placeholder="123456789012345678"
                              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 font-mono"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Message ID</label>
                            <input
                              type="text"
                              value={messageId}
                              onChange={(e) => { setMessageId(e.target.value); setSendStatus('idle') }}
                              placeholder="Leer lassen für neue Nachricht"
                              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 font-mono"
                            />
                          </div>
                          <button
                            onClick={sendEmbed}
                            disabled={!channelId.trim() || sendStatus === 'sending'}
                            className="w-full py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center justify-center gap-2"
                          >
                            {sendStatus === 'sending' && <Loader size={13} className="animate-spin" />}
                            {messageId.trim() ? 'Nachricht bearbeiten' : 'Nachricht senden'}
                          </button>
                          {sendStatus === 'ok' && (
                            <p className="text-xs text-green-400">Erfolgreich gesendet!</p>
                          )}
                          {sendStatus === 'error' && (
                            <p className="text-xs text-red-400">{sendError}</p>
                          )}
                        </div>
                      </>
                    )}
                  </div>

                  {/* Right: Preview */}
                  <div className="w-80 flex-shrink-0 overflow-y-auto p-4">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Vorschau</p>
                    {embeds[activeEmbedIdx] && <EmbedPreview embed={embeds[activeEmbedIdx]} />}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
