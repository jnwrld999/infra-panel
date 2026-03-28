import { useEffect, useRef, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  LayoutDashboard, Server, Puzzle, Bot as BotIcon,
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
  const { sidebarCollapsed, sidebarWidth, setSidebarCollapsed, setSidebarWidth, previewUser } = useUIStore()
  const [version, setVersion] = useState<string | null>(null)
  const isDragging = useRef(false)
  const dragStartX = useRef(0)
  const dragStartWidth = useRef(0)
  const [isResizing, setIsResizing] = useState(false)

  useEffect(() => {
    client.get<{ version: string }>('/info').then((r) => setVersion(r.data.version)).catch(() => {})
  }, [])

  const effectiveUser = previewUser ?? user
  const isBotOwner = effectiveUser?.role === 'bot_owner'
  const assignedBot = effectiveUser?.assigned_bot

  const fullNavItems: NavItem[] = [
    { to: '/', label: t('nav.dashboard'), icon: <LayoutDashboard size={18} /> },
    { to: '/servers', label: t('nav.servers'), icon: <Server size={18} /> },
    { to: '/plugins', label: t('nav.plugins'), icon: <Puzzle size={18} /> },
    { to: '/bots', label: t('nav.bots'), icon: <BotIcon size={18} /> },
    { to: '/approvals', label: t('nav.approvals'), icon: <ClipboardCheck size={18} />, adminOnly: true },
    { to: '/users', label: t('nav.users'), icon: <Users size={18} />, adminOnly: true },
    { to: '/logs', label: t('nav.logs'), icon: <ScrollText size={18} /> },
    { to: '/settings', label: t('nav.settings'), icon: <Settings size={18} /> },
  ]

  const botOwnerNavItems: NavItem[] = [
    { to: '/bot-dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
    { to: '/plugins', label: 'Plugins', icon: <Puzzle size={18} /> },
    { to: '/settings', label: 'Einstellungen', icon: <Settings size={18} /> },
  ]

  const navItems = isBotOwner ? botOwnerNavItems : fullNavItems

  const isAdminOrOwner = user?.role === 'admin' || user?.is_owner

  // Resize drag handlers
  const handleDragStart = (e: React.MouseEvent) => {
    e.preventDefault()
    isDragging.current = true
    dragStartX.current = e.clientX
    dragStartWidth.current = sidebarWidth
    setIsResizing(true)

    const onMove = (ev: MouseEvent) => {
      if (!isDragging.current) return
      const delta = ev.clientX - dragStartX.current
      const newWidth = Math.min(320, Math.max(160, dragStartWidth.current + delta))
      setSidebarWidth(newWidth)
    }
    const onUp = () => {
      isDragging.current = false
      setIsResizing(false)
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      window.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    window.addEventListener('mouseup', onUp)
  }

  const collapsed = sidebarCollapsed
  const width = collapsed ? 64 : sidebarWidth

  return (
    <aside
      style={{ width }}
      className={`relative h-screen sticky top-0 flex flex-col bg-card border-r border-border flex-shrink-0 overflow-hidden ${!isResizing ? 'transition-[width] duration-200 ease-in-out' : ''}`}
    >
      {/* Header — branding only */}
      <div className={`px-3 py-4 border-b border-border ${collapsed ? 'flex justify-center' : ''}`}>
        {collapsed ? (
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold">
            {isBotOwner && assignedBot ? assignedBot.name.slice(0, 2).toUpperCase() : 'IP'}
          </div>
        ) : (
          <div className="flex items-baseline gap-2">
            {isBotOwner && assignedBot ? (
              <h1 className="text-base font-bold text-primary truncate">{assignedBot.name}</h1>
            ) : (
              <h1 className="text-base font-bold text-primary truncate">GalaxyCraft Bot Panel</h1>
            )}
            {version && <span className="text-xs text-muted-foreground font-mono flex-shrink-0">v{version}</span>}
          </div>
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

      {/* User / Logout — full clickable row */}
      <button
        onClick={() => logout()}
        title={t('auth.logout')}
        className={`w-full px-3 py-3 border-t border-border flex items-center transition-colors group hover:bg-red-500/10 ${collapsed ? 'justify-center' : 'gap-3'}`}
      >
        {/* Avatar */}
        {user?.avatar_url ? (
          <img src={user.avatar_url} alt="" className="w-8 h-8 rounded-full flex-shrink-0 object-cover ring-1 ring-border group-hover:ring-red-400/50 transition-all" />
        ) : (
          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0 ring-1 ring-border group-hover:ring-red-400/50 transition-all">
            <span className="text-xs font-medium text-muted-foreground">{user?.username?.slice(0, 2).toUpperCase() ?? '?'}</span>
          </div>
        )}
        {/* Name + logout icon */}
        {!collapsed && (
          <>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-xs font-medium text-foreground truncate group-hover:text-red-400 transition-colors">
                {user?.username ?? ''}
                {user?.is_owner && <span className="ml-1 text-yellow-400">★</span>}
              </p>
              <p className="text-[10px] text-muted-foreground group-hover:text-red-400/70 transition-colors">{t('auth.logout')}</p>
            </div>
            <LogOut size={14} className="flex-shrink-0 text-muted-foreground group-hover:text-red-400 transition-colors" />
          </>
        )}
      </button>

      {/* Resize handle (only when expanded) */}
      {!collapsed && (
        <div
          onMouseDown={handleDragStart}
          className="absolute top-0 right-0 w-2 h-full cursor-col-resize hover:bg-primary/30 transition-colors"
        />
      )}
    </aside>
  )
}
