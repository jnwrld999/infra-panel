import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Settings2, Plus, Trash2, ChevronUp, ChevronDown } from 'lucide-react'
import { StatusBadge } from '@/components/StatusBadge'
import client from '@/api/client'
import { useUIStore, PanelType } from '@/store/uiStore'

// ---- Data types ----
interface Server { id: number; name: string; host: string; port: number; status: string; tags: string[] }
interface Approval { id: number; type: string; submitted_by: string }
interface LogEntry { id: number; timestamp: string; level: string; category: string; message: string }
interface SyncJob { id: number; status: string; server_id: number; completed_at: string | null; type: string }
interface DashboardUser { id: number; username: string; role: string; active: boolean }

const PANEL_DEFINITIONS: Record<PanelType, { label: string; icon: string }> = {
  servers:   { label: 'Server Status',         icon: '🖥️'  },
  approvals: { label: 'Ausstehende Freigaben', icon: '📋'  },
  errors:    { label: 'Fehler (24h)',           icon: '⚠️'  },
  sync:      { label: 'Letzte Synchronisation', icon: '🔄'  },
  users:     { label: 'Nutzer',                  icon: '👥'  },
}

// ---- Individual panel components ----

function ServersPanel({ servers }: { servers: Server[] }) {
  const onlineCount = servers.filter((s) => s.status === 'online').length
  return (
    <div className="space-y-3">
      <div className="text-3xl font-bold text-green-400">{onlineCount} / {servers.length}</div>
      <div className="space-y-1.5 mt-2">
        {servers.map((s) => (
          <div key={s.id} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
            <span className="text-sm text-foreground font-medium truncate">{s.name}</span>
            <StatusBadge status={s.status} />
          </div>
        ))}
        {servers.length === 0 && <p className="text-sm text-muted-foreground">Keine Server</p>}
      </div>
    </div>
  )
}

function ApprovalsPanel({ approvals }: { approvals: Approval[] }) {
  return (
    <div>
      <div className="text-3xl font-bold text-blue-400 mb-3">{approvals.length}</div>
      {approvals.slice(0, 5).map((a) => (
        <div key={a.id} className="text-sm text-muted-foreground py-1 border-b border-border last:border-0">
          {a.type} — {a.submitted_by}
        </div>
      ))}
      {approvals.length === 0 && <p className="text-sm text-muted-foreground">Keine ausstehenden Freigaben</p>}
    </div>
  )
}

function ErrorsPanel({ errors }: { errors: LogEntry[] }) {
  return (
    <div>
      <div className="text-3xl font-bold text-red-400 mb-3">{errors.length}</div>
      {errors.slice(0, 5).map((e) => (
        <div key={e.id} className="py-1.5 border-b border-border last:border-0">
          <div className="text-xs text-muted-foreground">{new Date(e.timestamp).toLocaleString('de-DE')}</div>
          <div className="text-sm text-red-300 truncate">{e.message}</div>
        </div>
      ))}
      {errors.length === 0 && <p className="text-sm text-muted-foreground text-green-400">Keine Fehler in 24h ✓</p>}
    </div>
  )
}

function SyncPanel({ jobs }: { jobs: SyncJob[] }) {
  const recent = jobs
    .filter((j) => j.completed_at)
    .sort((a, b) => new Date(b.completed_at!).getTime() - new Date(a.completed_at!).getTime())
    .slice(0, 5)
  return (
    <div>
      {recent.map((job) => (
        <div key={job.id} className="py-1.5 border-b border-border last:border-0">
          <div className="flex items-center justify-between">
            <span className="text-sm text-foreground capitalize">{job.type}</span>
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${job.status === 'success' ? 'bg-green-500/15 text-green-400' : job.status === 'running' ? 'bg-yellow-500/15 text-yellow-400' : 'bg-red-500/15 text-red-400'}`}>
              {job.status}
            </span>
          </div>
          <div className="text-xs text-muted-foreground">{new Date(job.completed_at!).toLocaleString('de-DE')}</div>
        </div>
      ))}
      {recent.length === 0 && <p className="text-sm text-muted-foreground">Keine Sync-Jobs</p>}
    </div>
  )
}

function UsersPanel({ users }: { users: DashboardUser[] }) {
  return (
    <div>
      <div className="text-3xl font-bold text-purple-400 mb-3">{users.length}</div>
      {users.slice(0, 6).map((u) => (
        <div key={u.id} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
          <span className="text-sm text-foreground truncate">{u.username}</span>
          <span className={`text-xs font-medium ${u.active ? 'text-green-400' : 'text-red-400'}`}>
            {u.active ? 'Aktiv' : 'Gesperrt'}
          </span>
        </div>
      ))}
      {users.length === 0 && <p className="text-sm text-muted-foreground">Keine Nutzer</p>}
    </div>
  )
}

// ---- Panel wrapper ----

interface PanelData {
  servers: Server[]
  approvals: Approval[]
  errors: LogEntry[]
  sync: SyncJob[]
  users: DashboardUser[]
}

function Panel({
  type, data, editMode, isFirst, isLast,
  onRemove, onMoveUp, onMoveDown
}: {
  type: PanelType
  data: PanelData
  editMode: boolean
  isFirst: boolean
  isLast: boolean
  onRemove: () => void
  onMoveUp: () => void
  onMoveDown: () => void
}) {
  const def = PANEL_DEFINITIONS[type]

  const renderContent = () => {
    switch (type) {
      case 'servers':   return <ServersPanel servers={data.servers} />
      case 'approvals': return <ApprovalsPanel approvals={data.approvals} />
      case 'errors':    return <ErrorsPanel errors={data.errors} />
      case 'sync':      return <SyncPanel jobs={data.sync} />
      case 'users':     return <UsersPanel users={data.users} />
    }
  }

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-base leading-none">{def.icon}</span>
          <h3 className="font-semibold text-foreground text-sm">{def.label}</h3>
        </div>
        {editMode && (
          <div className="flex items-center gap-1">
            <button onClick={onMoveUp} disabled={isFirst} className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 transition-colors">
              <ChevronUp size={14} />
            </button>
            <button onClick={onMoveDown} disabled={isLast} className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 transition-colors">
              <ChevronDown size={14} />
            </button>
            <button onClick={onRemove} className="p-1 rounded-md text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors ml-1">
              <Trash2 size={14} />
            </button>
          </div>
        )}
      </div>
      {renderContent()}
    </div>
  )
}

// ---- Dashboard ----

export default function Dashboard() {
  const { t } = useTranslation()
  const { dashboardPanels, setDashboardPanels } = useUIStore()
  const [editMode, setEditMode] = useState(false)
  const [data, setData] = useState<PanelData>({
    servers: [], approvals: [], errors: [], sync: [], users: [],
  })

  useEffect(() => {
    client.get('/servers/').then((r) => setData((d) => ({ ...d, servers: r.data }))).catch(() => {})
    client.get('/approvals/pending').then((r) => setData((d) => ({ ...d, approvals: r.data }))).catch(() => {})
    client.get('/logs/?level=ERROR&days=1&limit=20').then((r) => setData((d) => ({ ...d, errors: r.data }))).catch(() => {})
    client.get('/sync/').then((r) => setData((d) => ({ ...d, sync: r.data }))).catch(() => {})
    client.get('/users/').then((r) => setData((d) => ({ ...d, users: r.data }))).catch(() => {})
  }, [])

  const removePanel = (idx: number) => {
    setDashboardPanels(dashboardPanels.filter((_, i) => i !== idx))
  }

  const movePanel = (idx: number, dir: -1 | 1) => {
    const panels = [...dashboardPanels]
    const target = idx + dir
    if (target < 0 || target >= panels.length) return
    ;[panels[idx], panels[target]] = [panels[target], panels[idx]]
    setDashboardPanels(panels)
  }

  const addPanel = (type: PanelType) => {
    if (!dashboardPanels.includes(type)) {
      setDashboardPanels([...dashboardPanels, type])
    }
  }

  const availableToAdd = (Object.keys(PANEL_DEFINITIONS) as PanelType[]).filter(
    (t) => !dashboardPanels.includes(t)
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-foreground">{t('dashboard.title')}</h2>
        <button
          onClick={() => setEditMode(!editMode)}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
            editMode
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted border border-border'
          }`}
        >
          <Settings2 size={15} />
          {editMode ? 'Fertig' : 'Anpassen'}
        </button>
      </div>

      {/* Add panel buttons in edit mode */}
      {editMode && availableToAdd.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {availableToAdd.map((type) => (
            <button
              key={type}
              onClick={() => addPanel(type)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-border text-sm text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors"
            >
              <Plus size={14} />
              {PANEL_DEFINITIONS[type].label}
            </button>
          ))}
        </div>
      )}

      {/* Panels grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {dashboardPanels.map((type, idx) => (
          <Panel
            key={type}
            type={type}
            data={data}
            editMode={editMode}
            isFirst={idx === 0}
            isLast={idx === dashboardPanels.length - 1}
            onRemove={() => removePanel(idx)}
            onMoveUp={() => movePanel(idx, -1)}
            onMoveDown={() => movePanel(idx, 1)}
          />
        ))}
      </div>

      {dashboardPanels.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-sm">Keine Panels. Klicke auf "Anpassen" um Panels hinzuzufügen.</p>
        </div>
      )}
    </div>
  )
}
