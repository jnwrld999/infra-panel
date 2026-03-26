import { useEffect, useState } from 'react'
import { Plus, RefreshCw, Eye, X, Loader, ChevronDown, ChevronRight, MessageSquare } from 'lucide-react'
import { StatusBadge } from '@/components/StatusBadge'
import { useAuthStore } from '@/store/authStore'
import client from '@/api/client'

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

interface BotCreate {
  name: string
  server_id: number | ''
  token: string
  type: string
  description: string
}

interface Server { id: number; name: string }

export default function Bots() {
  const { user } = useAuthStore()
  const [bots, setBots] = useState<Bot[]>([])
  const [servers, setServers] = useState<Server[]>([])
  const [tokens, setTokens] = useState<Record<number, string>>({})
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

  useEffect(() => {
    client.get<Bot[]>('/bots/').then((r) => setBots(r.data)).catch(() => {})
    client.get<Server[]>('/servers/').then((r) => setServers(r.data)).catch(() => {})
  }, [])

  const showToken = (id: number) => {
    client.get(`/bots/${id}/token`)
      .then((r) => setTokens((prev) => ({ ...prev, [id]: r.data.token })))
      .catch(() => {})
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
    client.get<Plugin[]>(`/plugins/discord-bot/${botId}`)
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
        {user?.is_owner && (
          <button onClick={() => { setAddModal(true); setAddError('') }}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm hover:opacity-90 transition-opacity">
            <Plus size={14} /> Bot hinzufügen
          </button>
        )}
      </div>

      {/* Feature Request Banner */}
      <div className="bg-primary/10 border border-primary/20 rounded-lg px-4 py-3 flex items-start justify-between gap-4 mb-4">
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
      </div>

      <div className="space-y-4">
        {bots.map((bot) => (
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
                    <span className="font-semibold text-foreground">{bot.name}</span>
                    {!bot.restricted && bot.status && <StatusBadge status={bot.status} />}
                    {bot.type && <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{bot.type}</span>}
                  </div>
                  {bot.description && <p className="text-xs text-muted-foreground mt-0.5">{bot.description}</p>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {bot.restricted ? (
                  <span className="text-yellow-400 text-sm font-medium">Bot nicht verfügbar</span>
                ) : (
                  <>
                    {user?.is_owner && (
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
              <div className="mx-5 mb-3 text-xs font-mono bg-muted border border-border rounded p-2 text-green-400 break-all">
                {tokens[bot.id]}
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
                      const filePath = `/opt/bots/${bot.name}/cogs/${cog.filename}`
                      return (
                        <div key={cog.filename} className="flex items-center justify-between px-5 py-2.5 hover:bg-muted/20 transition-colors">
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-blue-400" />
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">{cog.name}</p>
                              <p className="text-xs text-muted-foreground truncate">{cog.filename}</p>
                            </div>
                          </div>
                          {bot.server_id && (
                            <button onClick={() => viewFile(bot.server_id!, filePath, cog.name)}
                              className="flex items-center gap-1 px-2 py-1 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                              <Eye size={13} /> Code
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
        {bots.length === 0 && (
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
    </div>
  )
}
