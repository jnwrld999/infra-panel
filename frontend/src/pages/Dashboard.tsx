import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { StatusBadge } from '@/components/StatusBadge'
import client from '@/api/client'

interface Server {
  id: number
  name: string
  host: string
  port: number
  status: string
  tags: string[]
}

interface Approval {
  id: number
  type: string
  submitted_by: string
}

interface LogEntry {
  id: number
  timestamp: string
  level: string
  category: string
  message: string
}

export default function Dashboard() {
  const { t } = useTranslation()
  const [servers, setServers] = useState<Server[]>([])
  const [approvals, setApprovals] = useState<Approval[]>([])
  const [errors, setErrors] = useState<LogEntry[]>([])

  useEffect(() => {
    client.get('/servers/').then((r) => setServers(r.data)).catch(() => {})
    client.get('/approvals/pending').then((r) => setApprovals(r.data)).catch(() => {})
    client.get('/logs/?level=ERROR&days=1&limit=5').then((r) => setErrors(r.data)).catch(() => {})
  }, [])

  const onlineCount = servers.filter((s) => s.status === 'online').length

  return (
    <div>
      <h2 className="text-2xl font-bold text-foreground mb-6">{t('dashboard.title')}</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-card border border-border rounded-lg p-5">
          <div className="text-muted-foreground text-sm mb-1">{t('dashboard.serversOnline')}</div>
          <div className="text-3xl font-bold text-green-400">{onlineCount} / {servers.length}</div>
        </div>
        <div className="bg-card border border-border rounded-lg p-5">
          <div className="text-muted-foreground text-sm mb-1">{t('dashboard.pendingApprovals')}</div>
          <div className="text-3xl font-bold text-blue-400">{approvals.length}</div>
        </div>
        <div className="bg-card border border-border rounded-lg p-5">
          <div className="text-muted-foreground text-sm mb-1">{t('dashboard.recentErrors')}</div>
          <div className="text-3xl font-bold text-red-400">{errors.length}</div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg p-5 mb-6">
        <h3 className="font-semibold text-foreground mb-3">Server</h3>
        <div className="space-y-2">
          {servers.map((server) => (
            <div key={server.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
              <span className="text-foreground font-medium">{server.name}</span>
              <StatusBadge status={server.status} />
            </div>
          ))}
          {servers.length === 0 && <p className="text-muted-foreground text-sm">Keine Server konfiguriert.</p>}
        </div>
      </div>

      {errors.length > 0 && (
        <div className="bg-card border border-border rounded-lg p-5">
          <h3 className="font-semibold text-foreground mb-3">{t('dashboard.recentErrors')}</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted-foreground text-left">
                  <th className="pb-2 pr-4">Zeit</th>
                  <th className="pb-2 pr-4">Kategorie</th>
                  <th className="pb-2">Nachricht</th>
                </tr>
              </thead>
              <tbody>
                {errors.map((e) => (
                  <tr key={e.id} className="border-t border-border">
                    <td className="py-2 pr-4 text-muted-foreground whitespace-nowrap">{new Date(e.timestamp).toLocaleString()}</td>
                    <td className="py-2 pr-4 text-orange-400">{e.category}</td>
                    <td className="py-2 text-red-300">{e.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
