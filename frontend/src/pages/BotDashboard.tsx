import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import client from '@/api/client'
import { StatusBadge } from '@/components/StatusBadge'
import { useAuthStore } from '@/store/authStore'
import { useUIStore } from '@/store/uiStore'
import { Bot, Puzzle, Server, Key, EyeOff, Copy, Pencil, Check, X, AlertTriangle, Zap, Layers, RefreshCw, Power } from 'lucide-react'

interface BotInfo {
  id: number; name: string; type: string; status: string
  token_configured: boolean
  server_id?: number | null
  server?: { name: string; host: string; status: string } | null
  plugins: { id: number; name: string; enabled: boolean; ext?: string }[]
}

interface LogEntry {
  id: number; timestamp: string | null; level: string; message: string; category: string | null
}

export default function BotDashboard() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const previewUser = (useUIStore as any)((s: any) => s.previewUser) ?? null
  const effectiveUser = previewUser ?? user
  const botId = (effectiveUser as any)?.assigned_bot?.id

  const [bot, setBot] = useState<BotInfo | null>(null)
  const [loading, setLoading] = useState(true)

  // Token
  const [token, setToken] = useState<string | null>(null)
  const [tokenRevealed, setTokenRevealed] = useState(false)
  const [tokenLoading, setTokenLoading] = useState(false)

  // Name edit
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [nameSaving, setNameSaving] = useState(false)

  // Plugin toggle
  const [togglingPlugin, setTogglingPlugin] = useState<string | null>(null)
  const [toggleError, setToggleError] = useState<string | null>(null)

  // Restart
  const [restarting, setRestarting] = useState(false)
  const [restartMsg, setRestartMsg] = useState<string | null>(null)

  // Error logs
  const [logs, setLogs] = useState<LogEntry[]>([])

  useEffect(() => {
    if (!botId) { setLoading(false); return }
    Promise.all([
      client.get(`/bots/${botId}`),
      client.get(`/plugins/discord-bot/${botId}`),
      client.get(`/logs/?level=ERROR&days=7&limit=5`),
    ]).then(([botRes, pluginRes, logsRes]) => {
      const rawPlugins: { name: string; status: string; filename?: string; type?: string }[] = pluginRes.data ?? []
      const plugins = rawPlugins.map((p, i) => {
        let ext = '.py'
        if (p.filename) {
          const base = p.filename.replace('.disabled', '')
          if (base.endsWith('.js')) ext = '.js'
          else if (base.endsWith('.py')) ext = '.py'
        } else if (p.type === 'nodejs') {
          ext = '.js'
        }
        return {
          id: i,
          name: p.name,
          enabled: p.status === 'active',
          ext,
        }
      })
      setBot({ ...botRes.data, plugins })
      setNameInput(botRes.data.name)
      setLogs(logsRes.data ?? [])
    }).catch(() => {}).finally(() => setLoading(false))
  }, [botId])

  const holdReveal = (reveal: boolean) => {
    if (reveal) {
      if (!token) {
        setTokenLoading(true)
        client.get(`/bots/${botId}/token`)
          .then((r) => { setToken(r.data.token); setTokenRevealed(true) })
          .catch(() => {})
          .finally(() => setTokenLoading(false))
      } else {
        setTokenRevealed(true)
      }
    } else {
      setTokenRevealed(false)
    }
  }

  const copyToken = () => {
    if (token) {
      navigator.clipboard.writeText(token)
    } else {
      client.get(`/bots/${botId}/token`)
        .then((r) => { setToken(r.data.token); navigator.clipboard.writeText(r.data.token) })
        .catch(() => {})
    }
  }

  const saveName = () => {
    if (!nameInput.trim() || !bot) return
    setNameSaving(true)
    client.patch(`/bots/${bot.id}`, { name: nameInput.trim() })
      .then((r) => { setBot((prev) => prev ? { ...prev, name: r.data.name } : prev); setEditingName(false) })
      .catch(() => {})
      .finally(() => setNameSaving(false))
  }

  const getPluginExtension = (pluginName: string): string => {
    const plugin = bot?.plugins.find((p) => p.name === pluginName)
    return plugin?.ext ?? '.py'
  }

  const togglePlugin = async (pluginName: string, currentlyEnabled: boolean) => {
    if (!bot || !botId) return
    setTogglingPlugin(pluginName)
    setToggleError(null)
    const botPath = `/root/Discord Bots/${bot.name}`
    const ext = getPluginExtension(pluginName)
    const filename = currentlyEnabled ? `${pluginName}${ext}` : `${pluginName}${ext}.disabled`
    try {
      await client.post(
        `/plugins/toggle-discord-cog?bot_id=${botId}&filename=${encodeURIComponent(filename)}&enable=${!currentlyEnabled}&bot_path=${encodeURIComponent(botPath)}`
      )
      setBot((prev) =>
        prev
          ? { ...prev, plugins: prev.plugins.map((p) => p.name === pluginName ? { ...p, enabled: !currentlyEnabled } : p) }
          : prev
      )
    } catch {
      setToggleError(`${pluginName} konnte nicht ${currentlyEnabled ? 'deaktiviert' : 'aktiviert'} werden`)
      setTimeout(() => setToggleError(null), 3000)
    } finally {
      setTogglingPlugin(null)
    }
  }

  const restartBot = async () => {
    if (!botId) return
    setRestarting(true)
    setRestartMsg(null)
    try {
      await client.post(`/bots/${botId}/restart`)
      setRestartMsg('Neustart gesendet ✓')
      setTimeout(() => setRestartMsg(null), 3000)
    } catch {
      setRestartMsg('Neustart fehlgeschlagen')
      setTimeout(() => setRestartMsg(null), 3000)
    } finally {
      setRestarting(false)
    }
  }

  if (loading) return <p className="text-muted-foreground">Lädt...</p>
  if (!bot) return <p className="text-muted-foreground">Kein Bot zugewiesen.</p>

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Bot size={20} className="text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          {editingName ? (
            <div className="flex items-center gap-2">
              <input
                autoFocus
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') setEditingName(false) }}
                className="text-xl font-bold bg-background border border-primary/50 rounded-md px-2 py-0.5 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 w-48"
              />
              <button onClick={saveName} disabled={nameSaving} className="p-1 rounded text-green-400 hover:bg-green-400/10 transition-colors disabled:opacity-50">
                <Check size={15} />
              </button>
              <button onClick={() => setEditingName(false)} className="p-1 rounded text-muted-foreground hover:bg-muted transition-colors">
                <X size={15} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-bold text-foreground">{bot.name}</h2>
              <button
                onClick={() => { setEditingName(true); setNameInput(bot.name) }}
                className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                title="Name bearbeiten"
              >
                <Pencil size={13} />
              </button>
            </div>
          )}
          <p className="text-sm text-muted-foreground">{bot.type} Bot</p>
        </div>
        <StatusBadge status={bot.status} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Token */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Key size={16} className="text-muted-foreground" />
            <h3 className="font-semibold text-foreground text-sm">Bot Token</h3>
          </div>
          {token ? (
            <div className="flex items-center gap-2 p-2 rounded bg-muted border border-border text-xs font-mono">
              <span className="flex-1 text-green-400 break-all">
                {tokenRevealed ? token : '•'.repeat(Math.min(token.length, 40))}
              </span>
              <button
                onMouseDown={() => holdReveal(true)}
                onMouseUp={() => holdReveal(false)}
                onMouseLeave={() => holdReveal(false)}
                onTouchStart={() => holdReveal(true)}
                onTouchEnd={() => holdReveal(false)}
                title="Halten zum Anzeigen"
                className="flex-shrink-0 p-1 rounded hover:bg-border text-muted-foreground hover:text-foreground transition-colors select-none"
              >
                <EyeOff size={12} />
              </button>
              <button onClick={copyToken} title="Kopieren"
                className="flex-shrink-0 p-1 rounded hover:bg-border text-muted-foreground hover:text-foreground transition-colors">
                <Copy size={12} />
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <p className={`text-sm font-medium ${bot.token_configured ? 'text-green-400' : 'text-red-400'}`}>
                {bot.token_configured ? '✓ Token konfiguriert' : '✗ Kein Token gesetzt'}
              </p>
              {bot.token_configured && (
                <button
                  onMouseDown={() => holdReveal(true)}
                  onMouseUp={() => holdReveal(false)}
                  onMouseLeave={() => holdReveal(false)}
                  onTouchStart={() => holdReveal(true)}
                  onTouchEnd={() => holdReveal(false)}
                  disabled={tokenLoading}
                  className="flex items-center gap-1 px-2 py-1 text-xs bg-muted border border-border rounded-md hover:bg-border transition-colors disabled:opacity-50 select-none"
                  title="Halten zum Anzeigen"
                >
                  <EyeOff size={11} /> {tokenLoading ? '...' : 'Halten'}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Server */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Server size={16} className="text-muted-foreground" />
            <h3 className="font-semibold text-foreground text-sm">Server</h3>
          </div>
          {bot.server ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-foreground font-medium">{bot.server.name}</p>
                <p className="text-xs text-muted-foreground">{bot.server.host}</p>
              </div>
              <StatusBadge status={bot.server.status} />
            </div>
          ) : <p className="text-sm text-muted-foreground">Kein Server verknüpft</p>}
        </div>

        {/* Quick Actions */}
        <div className="bg-card border border-border rounded-xl p-5 md:col-span-2">
          <div className="flex items-center gap-2 mb-3">
            <Zap size={16} className="text-muted-foreground" />
            <h3 className="font-semibold text-foreground text-sm">Schnellaktionen</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => navigate('/embed-builder')}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 border border-primary/20 text-primary text-xs font-medium hover:bg-primary/20 transition-colors"
            >
              <Layers size={13} /> Embed Builder
            </button>
            <button
              onClick={restartBot}
              disabled={restarting}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-xs font-medium hover:bg-yellow-500/20 transition-colors disabled:opacity-50"
            >
              <RefreshCw size={13} className={restarting ? 'animate-spin' : ''} />
              {restarting ? 'Startet...' : 'Bot neu starten'}
            </button>
          </div>
          {restartMsg && (
            <p className={`text-xs mt-2 ${restartMsg.includes('✓') ? 'text-green-400' : 'text-red-400'}`}>
              {restartMsg}
            </p>
          )}
        </div>

        {/* Plugins */}
        <div className="bg-card border border-border rounded-xl p-5 md:col-span-2">
          <div className="flex items-center gap-2 mb-1">
            <Puzzle size={16} className="text-muted-foreground" />
            <h3 className="font-semibold text-foreground text-sm">Plugins ({bot.plugins.length})</h3>
          </div>
          {toggleError && (
            <p className="text-xs text-red-400 mt-1 mb-2">{toggleError}</p>
          )}
          {bot.plugins.length > 0 ? (
            <div className="space-y-1.5">
              {bot.plugins.map((p) => (
                <div key={p.name} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                  <span className={`text-sm ${p.enabled ? 'text-foreground' : 'text-muted-foreground line-through'}`}>
                    {p.name}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-medium ${p.enabled ? 'text-green-400' : 'text-muted-foreground'}`}>
                      {p.enabled ? 'Aktiv' : 'Inaktiv'}
                    </span>
                    <button
                      onClick={() => togglePlugin(p.name, p.enabled)}
                      disabled={togglingPlugin === p.name}
                      title={p.enabled ? 'Deaktivieren' : 'Aktivieren'}
                      className={`p-1 rounded text-xs transition-colors disabled:opacity-50 ${
                        p.enabled
                          ? 'text-yellow-400 hover:bg-yellow-500/10'
                          : 'text-green-400 hover:bg-green-500/10'
                      }`}
                    >
                      <Power size={13} className={togglingPlugin === p.name ? 'animate-pulse' : ''} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-muted-foreground">Keine Plugins installiert</p>}
        </div>

        {/* Error Logs */}
        <div className="bg-card border border-border rounded-xl p-5 md:col-span-2">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={16} className="text-red-400" />
            <h3 className="font-semibold text-foreground text-sm">Letzte Fehler (7 Tage)</h3>
          </div>
          {logs.length > 0 ? (
            <div className="space-y-2">
              {logs.map((log) => (
                <div key={log.id} className="rounded-lg bg-red-500/5 border border-red-500/20 px-3 py-2">
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <span className="text-xs font-medium text-red-400">{log.category ?? 'system'}</span>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {log.timestamp ? new Date(log.timestamp).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' }) : ''}
                    </span>
                  </div>
                  <p className="text-xs text-foreground break-words">{log.message}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Keine Fehler in den letzten 7 Tagen.</p>
          )}
        </div>
      </div>
    </div>
  )
}
