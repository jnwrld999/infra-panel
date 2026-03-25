import { useEffect, useRef, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  LayoutDashboard, Server, RefreshCw, Settings2, Puzzle, Bot,
  ClipboardCheck, Users, ScrollText, Settings,
  ChevronLeft, ChevronRight, LogOut,
} from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { useUIStore } from '@/store/uiStore'
import client from '@/api/client'

interface NavItem {
  to: string
  label: string
  icon: React.ReactNode
  adminOnly?: boolean
}

export function Sidebar() {
  const { t } = useTranslation()
  const { user, logout } = useAuthStore()
  const { sidebarCollapsed, sidebarWidth, setSidebarCollapsed, setSidebarWidth } = useUIStore()
  const [version, setVersion] = useState<string | null>(null)
  const isDragging = useRef(false)
  const dragStartX = useRef(0)
  const dragStartWidth = useRef(sidebarWidth)

  useEffect(() => {
    client.get<{ version: string }>('/info').then((r) => setVersion(r.data.version)).catch(() => {})
  }, [])

  const navItems: NavItem[] = [
    { to: '/', label: t('nav.dashboard'), icon: <LayoutDashboard size={18} /> },
    { to: '/servers', label: t('nav.servers'), icon: <Server size={18} /> },
    { to: '/sync', label: t('nav.sync'), icon: <RefreshCw size={18} /> },
    { to: '/services', label: t('nav.services'), icon: <Settings2 size={18} /> },
    { to: '/plugins', label: t('nav.plugins'), icon: <Puzzle size={18} /> },
    { to: '/bots', label: t('nav.bots'), icon: <Bot size={18} /> },
    { to: '/approvals', label: t('nav.approvals'), icon: <ClipboardCheck size={18} />, adminOnly: true },
    { to: '/users', label: t('nav.users'), icon: <Users size={18} />, adminOnly: true },
    { to: '/logs', label: t('nav.logs'), icon: <ScrollText size={18} /> },
    { to: '/settings', label: t('nav.settings'), icon: <Settings size={18} /> },
  ]

  const isAdminOrOwner = user?.role === 'admin' || user?.is_owner

  // Resize drag handlers
  const handleDragStart = (e: React.MouseEvent) => {
    isDragging.current = true
    dragStartX.current = e.clientX
    dragStartWidth.current = sidebarWidth

    const onMove = (ev: MouseEvent) => {
      if (!isDragging.current) return
      const delta = ev.clientX - dragStartX.current
      const newWidth = Math.min(320, Math.max(160, dragStartWidth.current + delta))
      setSidebarWidth(newWidth)
    }
    const onUp = () => {
      isDragging.current = false
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  const collapsed = sidebarCollapsed
  const width = collapsed ? 64 : sidebarWidth

  return (
    <aside
      style={{ width }}
      className="relative min-h-screen flex flex-col bg-card border-r border-border transition-all duration-200 ease-in-out overflow-hidden flex-shrink-0"
    >
      {/* Header */}
      <div className={`px-3 py-4 border-b border-border ${collapsed ? 'flex justify-center' : ''}`}>
        {collapsed ? (
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold">IP</div>
        ) : (
          <>
            <div className="flex items-baseline gap-2">
              <h1 className="text-base font-bold text-primary truncate">InfraPanel</h1>
              {version && <span className="text-xs text-muted-foreground font-mono flex-shrink-0">v{version}</span>}
            </div>
            {user && (
              <div className="mt-1 text-xs text-muted-foreground truncate">
                {user.username}
                {user.is_owner && <span className="ml-1 text-yellow-400">★</span>}
              </div>
            )}
          </>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-2 px-1.5 space-y-0.5">
        {navItems.map((item) => {
          if (item.adminOnly && !isAdminOrOwner) return null
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              title={collapsed ? item.label : undefined}
              className={({ isActive }) =>
                `flex items-center rounded-md text-sm transition-colors ${
                  collapsed ? 'justify-center px-0 py-2.5' : 'gap-2.5 px-3 py-2'
                } ${
                  isActive
                    ? 'bg-primary text-primary-foreground font-medium'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`
              }
            >
              {item.icon}
              {!collapsed && item.label}
            </NavLink>
          )
        })}
      </nav>

      {/* Toggle collapse button */}
      <div className={`px-1.5 pb-1 flex ${collapsed ? 'justify-center' : 'justify-end'}`}>
        <button
          onClick={() => setSidebarCollapsed(!collapsed)}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* User / Logout */}
      <div className={`px-2 py-2 border-t border-border flex items-center ${collapsed ? 'justify-center' : 'justify-between gap-2'}`}>
        {!collapsed && (
          <span className="text-xs text-muted-foreground truncate flex-1 min-w-0">
            {user?.username ?? ''}
          </span>
        )}
        <button
          onClick={() => logout()}
          title={t('auth.logout')}
          className="flex-shrink-0 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <LogOut size={16} />
        </button>
      </div>

      {/* Resize handle (only when expanded) */}
      {!collapsed && (
        <div
          onMouseDown={handleDragStart}
          className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/30 transition-colors"
        />
      )}
    </aside>
  )
}
