import { useEffect, useState } from 'react'
import client from '@/api/client'
import { StatusBadge } from '@/components/StatusBadge'
import { useAuthStore } from '@/store/authStore'
import { useUIStore } from '@/store/uiStore'
import { Bot, Puzzle, Server, Key } from 'lucide-react'

interface BotInfo {
  id: number; name: string; type: string; status: string
  token_configured: boolean
  server?: { name: string; host: string; status: string } | null
  plugins: { id: number; name: string; enabled: boolean }[]
}

export default function BotDashboard() {
  const user = useAuthStore((s) => s.user)
  const previewUser = (useUIStore as any)((s: any) => s.previewUser) ?? null
  const effectiveUser = previewUser ?? user
  const botId = (effectiveUser as any)?.assigned_bot?.id

  const [bot, setBot] = useState<BotInfo | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!botId) { setLoading(false); return }
    Promise.all([
      client.get(`/bots/${botId}`),
      client.get(`/plugins/discord-bot/${botId}`),
    ]).then(([botRes, pluginRes]) => {
      const rawPlugins: { name: string; status: string }[] = pluginRes.data ?? []
      const plugins = rawPlugins.map((p, i) => ({
        id: i,
        name: p.name,
        enabled: p.status === 'active',
      }))
      setBot({ ...botRes.data, plugins })
    }).catch(() => {}).finally(() => setLoading(false))
  }, [botId])

  if (loading) return <p className="text-muted-foreground">Lädt...</p>
  if (!bot) return <p className="text-muted-foreground">Kein Bot zugewiesen.</p>

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Bot size={20} className="text-primary" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-foreground">{bot.name}</h2>
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
          <p className={`text-sm font-medium ${bot.token_configured ? 'text-green-400' : 'text-red-400'}`}>
            {bot.token_configured ? '✓ Token konfiguriert' : '✗ Kein Token gesetzt'}
          </p>
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

        {/* Plugins */}
        <div className="bg-card border border-border rounded-xl p-5 md:col-span-2">
          <div className="flex items-center gap-2 mb-3">
            <Puzzle size={16} className="text-muted-foreground" />
            <h3 className="font-semibold text-foreground text-sm">Plugins ({bot.plugins.length})</h3>
          </div>
          {bot.plugins.length > 0 ? (
            <div className="space-y-1.5">
              {bot.plugins.map((p) => (
                <div key={p.id} className="flex items-center justify-between py-1 border-b border-border last:border-0">
                  <span className="text-sm text-foreground">{p.name}</span>
                  <span className={`text-xs font-medium ${p.enabled ? 'text-green-400' : 'text-muted-foreground'}`}>
                    {p.enabled ? 'Aktiv' : 'Inaktiv'}
                  </span>
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-muted-foreground">Keine Plugins installiert</p>}
        </div>
      </div>
    </div>
  )
}
