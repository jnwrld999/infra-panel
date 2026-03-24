import { useEffect, useState } from 'react'
import client from '@/api/client'

interface User {
  id: number
  discord_id: string
  username: string
  role: string
  is_active: boolean
}

export default function Users() {
  const [users, setUsers] = useState<User[]>([])

  const load = () => {
    client.get('/users/').then((r) => setUsers(r.data)).catch(() => {})
  }

  useEffect(() => { load() }, [])

  const toggleActive = (user: User) => {
    client.patch(`/users/${user.id}`, { is_active: !user.is_active })
      .then(() => load())
      .catch(() => {})
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-foreground mb-6">Nutzer & Rollen</h2>
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr className="text-muted-foreground text-left">
              <th className="px-4 py-3">Discord ID</th>
              <th className="px-4 py-3">Username</th>
              <th className="px-4 py-3">Rolle</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Aktion</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-border hover:bg-muted/30">
                <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{u.discord_id}</td>
                <td className="px-4 py-3 text-foreground font-medium">{u.username}</td>
                <td className="px-4 py-3">
                  <span className="px-2 py-0.5 bg-muted rounded text-xs text-muted-foreground">{u.role}</span>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-medium ${u.is_active ? 'text-green-400' : 'text-red-400'}`}>
                    {u.is_active ? 'aktiv' : 'gesperrt'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => toggleActive(u)}
                    className={`px-2 py-1 text-xs rounded-md transition-colors ${
                      u.is_active
                        ? 'bg-red-600 hover:bg-red-700 text-white'
                        : 'bg-green-600 hover:bg-green-700 text-white'
                    }`}
                  >
                    {u.is_active ? 'Sperren' : 'Aktivieren'}
                  </button>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">Keine Nutzer gefunden.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
