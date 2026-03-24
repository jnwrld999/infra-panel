import { useEffect, useState } from 'react'
import { StatusBadge } from '@/components/StatusBadge'
import { useAuthStore } from '@/store/authStore'
import client from '@/api/client'

interface Bot {
  id: number
  name: string
  status: string
  restricted: boolean
  description?: string
}

export default function Bots() {
  const { user } = useAuthStore()
  const [bots, setBots] = useState<Bot[]>([])
  const [tokens, setTokens] = useState<Record<number, string>>({})

  useEffect(() => {
    client.get('/bots/').then((r) => setBots(r.data)).catch(() => {})
  }, [])

  const showToken = (id: number) => {
    client.get(`/bots/${id}/token`)
      .then((r) => setTokens((prev) => ({ ...prev, [id]: r.data.token })))
      .catch(() => {})
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-foreground mb-6">Bots</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {bots.map((bot) => (
          <div key={bot.id} className="bg-card border border-border rounded-lg p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-foreground text-lg">{bot.name}</span>
              {!bot.restricted && <StatusBadge status={bot.status} />}
            </div>
            {bot.description && <p className="text-muted-foreground text-sm mb-3">{bot.description}</p>}
            {bot.restricted ? (
              <div className="text-yellow-400 text-sm font-medium">Bot nicht verfügbar</div>
            ) : (
              <>
                {user?.is_owner && (
                  <button
                    onClick={() => showToken(bot.id)}
                    className="mt-2 px-3 py-1.5 text-sm bg-muted border border-border rounded-md text-foreground hover:bg-border transition-colors"
                  >
                    Show Token
                  </button>
                )}
                {tokens[bot.id] && (
                  <div className="mt-2 text-xs font-mono bg-muted border border-border rounded p-2 text-green-400 break-all">
                    {tokens[bot.id]}
                  </div>
                )}
              </>
            )}
          </div>
        ))}
        {bots.length === 0 && <p className="text-muted-foreground">Keine Bots konfiguriert.</p>}
      </div>
    </div>
  )
}
