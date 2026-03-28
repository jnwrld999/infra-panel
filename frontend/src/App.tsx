import './i18n'
import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { Layout } from '@/components/Layout'
import { UpdateNotification } from '@/components/UpdateNotification'
import Login from '@/pages/Login'
import NoAccess from '@/pages/NoAccess'
import Dashboard from '@/pages/Dashboard'
import Servers from '@/pages/Servers'
import Plugins from '@/pages/Plugins'
import Bots from '@/pages/Bots'
import Users from '@/pages/Users'
import Approvals from '@/pages/Approvals'
import Logs from '@/pages/Logs'
import Settings from '@/pages/Settings'
import BotDashboard from '@/pages/BotDashboard'

const GH_CACHE_KEY = 'infra-panel-gh-latest'
const GH_CACHE_TTL = 10 * 60 * 1000

async function fetchLatestGitHubVersion(): Promise<string | null> {
  try {
    const cached = localStorage.getItem(GH_CACHE_KEY)
    if (cached) {
      const { version, ts } = JSON.parse(cached)
      if (Date.now() - ts < GH_CACHE_TTL) return version
    }
    const res = await fetch('https://api.github.com/repos/jnwrld999/infra-panel/releases/latest')
    if (!res.ok) return null
    const data = await res.json()
    const version = (data.tag_name as string).replace(/^v/, '')
    localStorage.setItem(GH_CACHE_KEY, JSON.stringify({ version, ts: Date.now() }))
    return version
  } catch {
    return null
  }
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuthStore()
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground text-sm">Lädt...</div>
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace />
  return <Layout>{children}</Layout>
}

export default function App() {
  const { fetchMe } = useAuthStore()
  const [latestVersion, setLatestVersion] = useState<string | null>(null)
  const [currentVersion, setCurrentVersion] = useState<string | null>(null)

  useEffect(() => {
    fetchMe()
    fetch('/api/info')
      .then((r) => r.json())
      .then((data: { version: string }) => setCurrentVersion(data.version))
      .catch(() => {})
    fetchLatestGitHubVersion().then((v) => { if (v) setLatestVersion(v) })
  }, [fetchMe])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/no-access" element={<NoAccess />} />
        <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/servers" element={<ProtectedRoute><Servers /></ProtectedRoute>} />
        <Route path="/plugins" element={<ProtectedRoute><Plugins /></ProtectedRoute>} />
        <Route path="/bots" element={<ProtectedRoute><Bots /></ProtectedRoute>} />
        <Route path="/users" element={<ProtectedRoute><Users /></ProtectedRoute>} />
        <Route path="/approvals" element={<ProtectedRoute><Approvals /></ProtectedRoute>} />
        <Route path="/logs" element={<ProtectedRoute><Logs /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
        <Route path="/bot-dashboard" element={<ProtectedRoute><BotDashboard /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <UpdateNotification latestVersion={latestVersion} currentVersion={currentVersion} />
    </BrowserRouter>
  )
}
