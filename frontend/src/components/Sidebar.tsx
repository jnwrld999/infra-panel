import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  LayoutDashboard,
  Server,
  RefreshCw,
  Settings2,
  Puzzle,
  Bot,
  ClipboardCheck,
  Users,
  ScrollText,
  Settings,
} from 'lucide-react'
import { useAuthStore } from '@/store/authStore'

interface NavItem {
  to: string
  label: string
  icon: React.ReactNode
  ownerOnly?: boolean
  adminOnly?: boolean
}

export function Sidebar() {
  const { t } = useTranslation()
  const { user, logout } = useAuthStore()

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

  return (
    <aside className="w-56 min-h-screen flex flex-col bg-card border-r border-border">
      <div className="px-4 py-5 border-b border-border">
        <h1 className="text-lg font-bold text-primary">InfraPanel</h1>
        {user && (
          <div className="mt-1 text-sm text-muted-foreground">
            {user.username}
            {user.is_owner && (
              <span className="ml-1 text-yellow-400 text-xs">★ Owner</span>
            )}
          </div>
        )}
      </div>

      <nav className="flex-1 py-3 px-2 space-y-0.5">
        {navItems.map((item) => {
          if (item.adminOnly && !isAdminOrOwner) return null
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
                  isActive
                    ? 'bg-primary text-primary-foreground font-medium'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`
              }
            >
              {item.icon}
              {item.label}
            </NavLink>
          )
        })}
      </nav>

      <div className="px-2 py-3 border-t border-border">
        <button
          onClick={() => logout()}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          {t('auth.logout')}
        </button>
      </div>
    </aside>
  )
}
