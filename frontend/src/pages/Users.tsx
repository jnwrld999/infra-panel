import { useEffect, useState } from 'react'
import { Check, X, ChevronRight, User, Plus } from 'lucide-react'
import client from '@/api/client'
import { Toggle } from '@/components/Toggle'

interface DiscordUser {
  id: number
  discord_id: string
  username: string
  role: string
  verified: boolean
  active: boolean
  added_by?: string
  added_at?: string
  last_action?: string
}

const ROLES = ['owner', 'admin', 'operator', 'moderator', 'viewer']
const ROLE_COLORS: Record<string, string> = {
  owner:     'bg-red-500/15 text-red-400',
  admin:     'bg-purple-500/15 text-purple-400',
  operator:  'bg-yellow-500/15 text-yellow-400',
  moderator: 'bg-blue-500/15 text-blue-400',
  viewer:    'bg-muted text-muted-foreground',
}

export default function Users() {
  const [users, setUsers] = useState<DiscordUser[]>([])
  const [selected, setSelected] = useState<DiscordUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [addModal, setAddModal] = useState(false)
  const [addForm, setAddForm] = useState({ discord_id: '', role: 'viewer' })
  const [addLoading, setAddLoading] = useState(false)
  const [addError, setAddError] = useState('')
  const [bots, setBots] = useState<{ id: number; name: string }[]>([])
  const [userBotAccess, setUserBotAccess] = useState<Record<number, number[]>>({})
  const [addFormBots, setAddFormBots] = useState<number[]>([])

  const load = () => {
    setLoading(true)
    client.get<DiscordUser[]>('/users/').then(r => {
      setUsers(r.data)
      setLoading(false)
    }).catch(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  useEffect(() => {
    client.get<{ id: number; name: string; restricted: boolean }[]>('/bots/').then(r =>
      setBots(r.data.map(b => ({ id: b.id, name: b.name })))
    ).catch(() => {})
  }, [])

  const selectUser = (u: DiscordUser) => {
    setSelected(u)
    if (userBotAccess[u.id] === undefined) {
      client.get<{ discord_id: string; bot_ids: number[] }>(`/users/${u.id}/bot-access`)
        .then(r => setUserBotAccess(prev => ({ ...prev, [u.id]: r.data.bot_ids })))
        .catch(() => setUserBotAccess(prev => ({ ...prev, [u.id]: [] })))
    }
  }

  const submitAddUser = () => {
    if (!addForm.discord_id.trim()) { setAddError('Discord ID ist erforderlich.'); return }
    setAddLoading(true)
    setAddError('')
    client.post('/users/', { discord_id: addForm.discord_id.trim(), role: addForm.role })
      .then(r => {
        const newUser = r.data
        setUsers(prev => [...prev, newUser])
        // Grant bot access for selected bots
        addFormBots.forEach(botId => {
          client.post(`/bots/${botId}/whitelist/${addForm.discord_id.trim()}`).catch(() => {})
        })
        setAddModal(false)
        setAddForm({ discord_id: '', role: 'viewer' })
        setAddFormBots([])
      })
      .catch(e => setAddError(e?.response?.data?.detail || 'Fehler beim Hinzufügen.'))
      .finally(() => setAddLoading(false))
  }

  const updateUser = (id: number, patch: Partial<DiscordUser>) => {
    client.patch(`/users/${id}`, patch).then(() => {
      setUsers(prev => prev.map(u => u.id === id ? { ...u, ...patch } : u))
      setSelected(prev => prev?.id === id ? { ...prev, ...patch } : prev)
    }).catch(() => {})
  }

  const toggleBotAccess = (user: DiscordUser, botId: number, grant: boolean) => {
    const endpoint = `/bots/${botId}/whitelist/${user.discord_id}`
    const req = grant ? client.post(endpoint) : client.delete(endpoint)
    req.then(() => {
      setUserBotAccess(prev => ({
        ...prev,
        [user.id]: grant
          ? [...(prev[user.id] ?? []), botId]
          : (prev[user.id] ?? []).filter(id => id !== botId),
      }))
    }).catch(() => {})
  }

  return (
    <div className="flex gap-6">
      {/* Table */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-foreground">Nutzer</h2>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">{users.length} Nutzer</span>
            <button
              onClick={() => setAddModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm hover:bg-primary/90 transition-colors"
            >
              <Plus size={14} /> Nutzer hinzufügen
            </button>
          </div>
        </div>
        {loading ? (
          <div className="text-center text-sm text-muted-foreground py-20">Lädt…</div>
        ) : (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Nutzer</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Rolle</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Verifiziert</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {users.map(u => (
                  <tr key={u.id}
                    onClick={() => selectUser(u)}
                    className={`cursor-pointer hover:bg-muted/20 transition-colors ${selected?.id === u.id ? 'bg-primary/5' : ''}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                          <User size={14} className="text-muted-foreground" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{u.username}</p>
                          <p className="text-xs text-muted-foreground font-mono">{u.discord_id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS[u.role] ?? ROLE_COLORS.viewer}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {u.verified
                        ? <Check size={14} className="text-green-400" />
                        : <X size={14} className="text-muted-foreground" />}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium ${u.active ? 'text-green-400' : 'text-red-400'}`}>
                        {u.active ? 'Aktiv' : 'Gesperrt'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <ChevronRight size={14} className="text-muted-foreground" />
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-sm text-muted-foreground">Keine Nutzer gefunden</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail panel */}
      {selected && (
        <div className="w-72 flex-shrink-0 bg-card border border-border rounded-xl p-5 space-y-5 self-start sticky top-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-semibold text-foreground">{selected.username}</p>
              <p className="text-xs text-muted-foreground font-mono mt-0.5">{selected.discord_id}</p>
            </div>
            <button onClick={() => setSelected(null)} className="p-1 rounded hover:bg-muted text-muted-foreground">
              <X size={14} />
            </button>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Rolle</label>
            <div className="flex flex-col gap-1">
              {ROLES.map(r => (
                <button key={r} onClick={() => updateUser(selected.id, { role: r })}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                    selected.role === r ? 'bg-primary/10 text-primary border border-primary/30' : 'hover:bg-muted text-muted-foreground border border-transparent'
                  }`}>
                  <span>{r}</span>
                  {selected.role === r && <Check size={13} />}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wide">Optionen</label>
            <div className="flex items-center justify-between">
              <span className="text-sm text-foreground">Verifiziert</span>
              <Toggle checked={selected.verified} onChange={(val) => updateUser(selected.id, { verified: val })} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-foreground">Aktiv</span>
              <Toggle checked={selected.active} onChange={(val) => updateUser(selected.id, { active: val })} />
            </div>
          </div>

          {bots.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Bot-Zugriff</label>
              <div className="space-y-1">
                {bots.map(bot => {
                  const hasAccess = (userBotAccess[selected.id] ?? []).includes(bot.id)
                  return (
                    <div key={bot.id} className="flex items-center justify-between py-1">
                      <span className="text-xs text-foreground">{bot.name}</span>
                      <Toggle
                        checked={hasAccess}
                        onChange={(val) => toggleBotAccess(selected, bot.id, val)}
                      />
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {selected.added_at && (
            <p className="text-xs text-muted-foreground border-t border-border pt-3">
              Hinzugefügt: {new Date(selected.added_at).toLocaleDateString('de-DE')}
            </p>
          )}
        </div>
      )}

      {addModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card border border-border rounded-lg p-6 w-full max-w-md shadow-xl">
            <h3 className="text-base font-semibold mb-4">Nutzer hinzufügen</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Discord ID *</label>
                <input
                  type="text"
                  value={addForm.discord_id}
                  onChange={e => setAddForm(prev => ({ ...prev, discord_id: e.target.value }))}
                  placeholder="123456789012345678"
                  className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Rolle</label>
                <select
                  value={addForm.role}
                  onChange={e => setAddForm(prev => ({ ...prev, role: e.target.value }))}
                  className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="viewer">Viewer</option>
                  <option value="moderator">Moderator</option>
                  <option value="operator">Operator</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              {bots.length > 0 && (
                <div>
                  <label className="block text-sm font-medium mb-2">Bot-Zugriff</label>
                  <div className="space-y-1 max-h-40 overflow-y-auto border border-border rounded-md p-2">
                    {bots.map(bot => (
                      <label key={bot.id} className="flex items-center gap-2 cursor-pointer py-0.5">
                        <input
                          type="checkbox"
                          checked={addFormBots.includes(bot.id)}
                          onChange={e => setAddFormBots(prev =>
                            e.target.checked ? [...prev, bot.id] : prev.filter(id => id !== bot.id)
                          )}
                          className="rounded"
                        />
                        <span className="text-xs">{bot.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
              {addError && <p className="text-sm text-destructive">{addError}</p>}
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => { setAddModal(false); setAddError(''); setAddFormBots([]) }}
                className="px-4 py-2 rounded-md border border-border text-sm hover:bg-muted transition-colors"
              >
                Abbrechen
              </button>
              <button
                onClick={submitAddUser}
                disabled={addLoading}
                className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {addLoading ? 'Hinzufügen...' : 'Nutzer hinzufügen'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
