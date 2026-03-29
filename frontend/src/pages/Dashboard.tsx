import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Settings2, Plus, Trash2, GripVertical } from 'lucide-react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  rectSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { StatusBadge } from '@/components/StatusBadge'
import { ServerMonitor } from '@/components/ServerMonitor'
import client from '@/api/client'
import { useUIStore, PanelType } from '@/store/uiStore'
import { useAuthStore } from '@/store/authStore'
import { useUserName } from '@/hooks/useUserName'

// ---- Data types ----
interface Server { id: number; name: string; host: string; port: number; status: string; tags: string[] }
interface Approval { id: number; type: string; submitted_by: string }
interface LogEntry { id: number; timestamp: string; level: string; category: string; message: string }
interface DashboardUser { id: number; username: string; role: string; active: boolean }

const PANEL_DEFINITIONS: Record<PanelType, { label: string; icon: string }> = {
  servers:            { label: 'Server Status',         icon: '🖥️' },
  approvals:          { label: 'Ausstehende Freigaben', icon: '📋' },
  errors:             { label: 'Fehler (24h)',           icon: '⚠️' },
  users:              { label: 'Nutzer',                 icon: '👥' },
  server_monitoring:  { label: 'Server Monitoring',      icon: '📊' },
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

function ApprovalItemDisplay({ approval }: { approval: Approval }) {
  const submitterName = useUserName(approval.submitted_by)
  return (
    <div className="text-sm text-muted-foreground py-1 border-b border-border last:border-0">
      {approval.type} — <span title={approval.submitted_by}>{submitterName}</span>
    </div>
  )
}

function ApprovalsPanel({ approvals }: { approvals: Approval[] }) {
  return (
    <div>
      <div className="text-3xl font-bold text-blue-400 mb-3">{approvals.length}</div>
      {approvals.slice(0, 5).map((a) => (
        <ApprovalItemDisplay key={a.id} approval={a} />
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

function ServerMonitoringPanel({ servers }: { servers: Server[] }) {
  if (servers.length === 0) {
    return <p className="text-sm text-muted-foreground">Keine Server konfiguriert.</p>
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {servers.map((s) => (
        <ServerMonitor key={s.id} serverId={s.id} serverName={s.name} />
      ))}
    </div>
  )
}

// ---- Blurred preview for the "add panel" button ----

function MonitoringPreview() {
  // Static fake chart lines and bars, looks like a monitoring widget
  const fakeLine = (color: string, pts: [number, number][]) => {
    const d = 'M ' + pts.map(([x, y]) => `${x},${y}`).join(' L ')
    const fill = `M ${pts[0][0]},56 L ${pts.map(([x, y]) => `${x},${y}`).join(' L ')} L ${pts[pts.length - 1][0]},56 Z`
    return (
      <>
        <path d={fill} fill={color} fillOpacity="0.15" />
        <path d={d} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
      </>
    )
  }

  const cpuPts: [number, number][] = [[0,38],[8,30],[16,42],[24,20],[32,34],[40,18],[48,28],[56,36],[64,22],[72,32],[80,16],[88,28],[96,24],[104,36],[112,20],[120,30]]
  const ramPts: [number, number][] = [[0,44],[8,42],[16,40],[24,38],[32,42],[40,36],[48,40],[56,38],[64,36],[72,40],[80,34],[88,38],[96,36],[104,34],[112,38],[120,32]]

  return (
    <div className="space-y-2 p-1 pointer-events-none select-none">
      {/* Fake server row */}
      <div className="flex items-center gap-1.5 mb-1">
        <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
        <div className="h-2 w-20 rounded bg-muted-foreground/30" />
      </div>
      {/* CPU fake chart */}
      <div className="rounded bg-muted/30 overflow-hidden" style={{ height: 56 }}>
        <svg viewBox="0 0 120 56" preserveAspectRatio="none" className="w-full h-full">
          {fakeLine('#3b82f6', cpuPts)}
        </svg>
      </div>
      {/* RAM fake chart */}
      <div className="rounded bg-muted/30 overflow-hidden" style={{ height: 40 }}>
        <svg viewBox="0 0 120 56" preserveAspectRatio="none" className="w-full h-full">
          {fakeLine('#f59e0b', ramPts)}
        </svg>
      </div>
      {/* Fake disk bar */}
      <div className="h-2 rounded-full bg-muted/40 overflow-hidden">
        <div className="h-full w-2/3 rounded-full bg-green-500/60" />
      </div>
    </div>
  )
}

// ---- Panel wrapper ----

interface PanelData {
  servers: Server[]
  approvals: Approval[]
  errors: LogEntry[]
  users: DashboardUser[]
}

function Panel({
  type, data, editMode, onRemove, dragHandle,
}: {
  type: PanelType
  data: PanelData
  editMode: boolean
  onRemove: () => void
  dragHandle?: React.ReactNode
}) {
  const def = PANEL_DEFINITIONS[type]
  const colSpan = type === 'server_monitoring' ? 'xl:col-span-2 md:col-span-2' : ''

  const renderContent = () => {
    switch (type) {
      case 'servers':           return <ServersPanel servers={data.servers} />
      case 'approvals':         return <ApprovalsPanel approvals={data.approvals} />
      case 'errors':            return <ErrorsPanel errors={data.errors} />
      case 'users':             return <UsersPanel users={data.users} />
      case 'server_monitoring': return <ServerMonitoringPanel servers={data.servers} />
    }
  }

  return (
    <div className={`bg-card border border-border rounded-xl p-5 ${colSpan}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-base leading-none">{def.icon}</span>
          <h3 className="font-semibold text-foreground text-sm">{def.label}</h3>
        </div>
        {editMode && (
          <div className="flex items-center gap-1">
            {dragHandle}
            <button
              onClick={onRemove}
              className="p-1 rounded-md text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <Trash2 size={14} />
            </button>
          </div>
        )}
      </div>
      {renderContent()}
    </div>
  )
}

// ---- Sortable panel wrapper ----

function SortablePanel({
  id, type, data, editMode, onRemove,
}: {
  id: string
  type: PanelType
  data: PanelData
  editMode: boolean
  onRemove: () => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
    position: isDragging ? 'relative' : undefined,
  }

  const dragHandle = editMode ? (
    <button
      {...attributes}
      {...listeners}
      className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-grab active:cursor-grabbing"
      title="Verschieben"
    >
      <GripVertical size={14} />
    </button>
  ) : undefined

  return (
    <div ref={setNodeRef} style={style}>
      <Panel
        type={type}
        data={data}
        editMode={editMode}
        onRemove={onRemove}
        dragHandle={dragHandle}
      />
    </div>
  )
}

// ---- Dashboard ----

export default function Dashboard() {
  const { t } = useTranslation()
  const { dashboardPanels, setDashboardPanels } = useUIStore()
  const { user } = useAuthStore()
  const [editMode, setEditMode] = useState(false)
  const [data, setData] = useState<PanelData>({
    servers: [], approvals: [], errors: [], users: [],
  })

  const isAdminOrOwner = user?.role === 'owner' || user?.role === 'admin'

  // Filter out server_monitoring for non-admin/owner
  const visiblePanels = isAdminOrOwner
    ? dashboardPanels
    : dashboardPanels.filter((p) => p !== 'server_monitoring')

  useEffect(() => {
    client.get('/servers/').then((r) => setData((d) => ({ ...d, servers: r.data }))).catch(() => {})
    client.get('/approvals/pending').then((r) => setData((d) => ({ ...d, approvals: r.data }))).catch(() => {})
    client.get('/logs/?level=ERROR&days=1&limit=20').then((r) => setData((d) => ({ ...d, errors: r.data }))).catch(() => {})
    client.get('/users/').then((r) => setData((d) => ({ ...d, users: r.data }))).catch(() => {})
  }, [])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = dashboardPanels.indexOf(active.id as PanelType)
    const newIndex = dashboardPanels.indexOf(over.id as PanelType)
    setDashboardPanels(arrayMove(dashboardPanels, oldIndex, newIndex))
  }

  const addPanel = (type: PanelType) => {
    if (!dashboardPanels.includes(type)) {
      setDashboardPanels([...dashboardPanels, type])
    }
  }

  const availableToAdd = (Object.keys(PANEL_DEFINITIONS) as PanelType[]).filter((p) => {
    if (dashboardPanels.includes(p)) return false
    if (p === 'server_monitoring' && !isAdminOrOwner) return false
    return true
  })

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

      {/* Add panel options in edit mode */}
      {editMode && availableToAdd.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2 items-start">
          {availableToAdd.map((type) =>
            type === 'server_monitoring' ? (
              // Blurred preview card for server monitoring
              <div
                key={type}
                onClick={() => addPanel(type)}
                className="relative w-48 rounded-xl border border-dashed border-border overflow-hidden cursor-pointer hover:border-primary/60 transition-colors group"
              >
                {/* Blurred background preview */}
                <div className="blur-sm opacity-60 p-3">
                  <MonitoringPreview />
                </div>
                {/* Cover overlay */}
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-background/50 backdrop-blur-[2px]">
                  <Plus size={16} className="text-muted-foreground group-hover:text-foreground transition-colors" />
                  <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                    Server Monitoring
                  </span>
                </div>
              </div>
            ) : (
              <button
                key={type}
                onClick={() => addPanel(type)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-border text-sm text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors"
              >
                <Plus size={14} />
                {PANEL_DEFINITIONS[type].label}
              </button>
            )
          )}
        </div>
      )}

      {/* Panels grid */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={dashboardPanels} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {visiblePanels.map((type) => (
              <SortablePanel
                key={type}
                id={type}
                type={type}
                data={data}
                editMode={editMode}
                onRemove={() => {
                  const newPanels = dashboardPanels.filter((p) => p !== type)
                  setDashboardPanels(newPanels)
                }}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {visiblePanels.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-sm">Keine Panels. Klicke auf "Anpassen" um Panels hinzuzufügen.</p>
        </div>
      )}
    </div>
  )
}
