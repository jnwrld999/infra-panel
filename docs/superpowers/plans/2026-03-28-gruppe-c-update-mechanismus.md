# Update-Mechanismus Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the broken update check in TopBar (remove dead sync code, use GitHub Releases API), add a clickable update badge, and show a toast notification when a new version is available.

**Architecture:** TopBar fetches GitHub Releases API once on mount (cached 10min in localStorage), compares tag with current version from `/api/info`, and sets `updateAvailable`. A new `UpdateNotification` component renders a dismissable toast banner. App.tsx removes its duplicate version-check logic.

**Tech Stack:** React 19 + TypeScript + Zustand, lucide-react icons, GitHub REST API (public, no auth)

---

## File Map

| File | Change |
|------|--------|
| `frontend/src/components/TopBar.tsx` | Remove sync code, fix update check via GitHub API, make badge clickable |
| `frontend/src/components/UpdateNotification.tsx` | **Create** — dismissable toast banner |
| `frontend/src/App.tsx` | Remove duplicate version-check, mount `UpdateNotification` |

---

## Task 1: Remove dead sync code from TopBar and fix update check

**Files:**
- Modify: `frontend/src/components/TopBar.tsx`

- [ ] **Step 1: Replace TopBar.tsx with the fixed version**

The current file has: `/sync/` API call, broken update logic, dead sync state. Replace the entire file with:

```tsx
import { useEffect, useState } from 'react'
import { RefreshCw, Clock, AlertTriangle, Loader, RotateCcw, Download, ArrowUpCircle } from 'lucide-react'
import client from '@/api/client'
import { useUIStore } from '@/store/uiStore'

interface AppInfo { version: string; build_date: string; latest_version?: string }
interface LogEntry { id: number }

const GH_CACHE_KEY = 'infra-panel-gh-latest'
const GH_CACHE_TTL = 10 * 60 * 1000 // 10 minutes

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

function isNewerVersion(latest: string, current: string): boolean {
  const toNum = (v: string) => v.split('.').map(Number)
  const [lMaj, lMin, lPat] = toNum(latest)
  const [cMaj, cMin, cPat] = toNum(current)
  if (lMaj !== cMaj) return lMaj > cMaj
  if (lMin !== cMin) return lMin > cMin
  return lPat > cPat
}

export function TopBar() {
  const [info, setInfo] = useState<AppInfo | null>(null)
  const [latestVersion, setLatestVersion] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)
  const [errorCount, setErrorCount] = useState(0)
  const lastReload = useUIStore((s) => s.lastReload)
  const previewUser = useUIStore((s) => s.previewUser)
  const clearPreview = useUIStore((s) => s.clearPreview)

  useEffect(() => {
    client.get<AppInfo>('/info').then((r) => setInfo(r.data)).catch(() => {})
    client.get<LogEntry[]>('/logs/?level=ERROR&days=1&limit=50').then((r) => {
      setErrorCount(r.data.length)
    }).catch(() => {})
    fetchLatestGitHubVersion().then((v) => { if (v) setLatestVersion(v) })
  }, [])

  const checkForUpdates = () => {
    setChecking(true)
    localStorage.removeItem(GH_CACHE_KEY) // force refresh
    fetchLatestGitHubVersion()
      .then((v) => { if (v) setLatestVersion(v) })
      .finally(() => setChecking(false))
  }

  const updateAvailable = !!(info && latestVersion && isNewerVersion(latestVersion, info.version))

  return (
    <>
      {/* Preview banner */}
      {previewUser && (
        <div className="bg-primary/20 border-b border-primary/30 px-4 py-1.5 flex items-center justify-between text-xs">
          <span className="text-primary font-medium">
            Vorschau als <strong>{previewUser.username}</strong> ({previewUser.role})
          </span>
          <button
            onClick={clearPreview}
            className="px-2 py-0.5 bg-primary text-primary-foreground rounded text-xs hover:opacity-90"
          >
            Beenden
          </button>
        </div>
      )}

      {/* Main TopBar */}
      <div className="relative flex items-center gap-4 px-4 py-2 bg-card border-b border-border flex-wrap">
        {/* Version */}
        {info && (
          <div className="flex items-center gap-1.5 text-xs">
            {updateAvailable ? (
              <a
                href="https://github.com/jnwrld999/infra-panel/releases/latest"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 font-medium hover:bg-blue-500/25 transition-colors"
                title={`v${latestVersion} herunterladen`}
              >
                <ArrowUpCircle size={11} />
                v{latestVersion} verfügbar
              </a>
            ) : (
              <span className="text-muted-foreground font-mono">v{info.version}</span>
            )}
            <button
              onClick={checkForUpdates}
              disabled={checking}
              title="Auf Updates prüfen"
              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
            >
              {checking ? <Loader size={11} className="animate-spin" /> : <RefreshCw size={11} />}
            </button>
          </div>
        )}

        <div className="w-px h-3 bg-border flex-shrink-0" />

        {/* Errors */}
        <div className={`flex items-center gap-1.5 text-xs ${errorCount > 0 ? 'text-red-400' : 'text-muted-foreground'}`}>
          <AlertTriangle size={12} />
          <span>{errorCount} Fehler (24h)</span>
        </div>

        {/* Centered Reload display */}
        {lastReload && (
          <div className="absolute left-1/2 -translate-x-1/2">
            <span className="text-xs text-muted-foreground">
              Reload: {lastReload.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        )}

        <div className="ml-auto flex items-center gap-3">
          {!window.infraPanel && (
            <a
              href="https://github.com/jnwrld999/infra-panel/releases/latest"
              target="_blank"
              rel="noopener noreferrer"
              title="Desktop App herunterladen"
              className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <Download size={12} />
              Download
            </a>
          )}
          <button
            onClick={() => {
              if (window.infraPanel?.restart) {
                window.infraPanel.restart()
              } else {
                window.location.reload()
              }
            }}
            title="App neu starten"
            className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <RotateCcw size={12} />
            Neu starten
          </button>
        </div>
      </div>
    </>
  )
}
```

- [ ] **Step 2: Verify build passes**
```bash
cd /home/juice/infra-panel/frontend && npm run build 2>&1 | tail -5
```
Expected: `✓ built in`

- [ ] **Step 3: Commit**
```bash
cd /home/juice/infra-panel
git add frontend/src/components/TopBar.tsx
git commit -m "fix: remove dead sync code, fix update check via GitHub Releases API"
```

---

## Task 2: Create UpdateNotification toast component

**Files:**
- Create: `frontend/src/components/UpdateNotification.tsx`

- [ ] **Step 1: Create the file**

```tsx
import { useState, useEffect } from 'react'
import { ArrowUpCircle, X } from 'lucide-react'

const NOTIFIED_KEY = 'infra-panel-notified-version'

interface UpdateNotificationProps {
  latestVersion: string | null
  currentVersion: string | null
}

export function UpdateNotification({ latestVersion, currentVersion }: UpdateNotificationProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!latestVersion || !currentVersion) return
    if (latestVersion === currentVersion) return
    const notified = localStorage.getItem(NOTIFIED_KEY)
    if (notified === latestVersion) return
    setVisible(true)
  }, [latestVersion, currentVersion])

  const dismiss = () => {
    if (latestVersion) localStorage.setItem(NOTIFIED_KEY, latestVersion)
    setVisible(false)
  }

  if (!visible || !latestVersion) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-3 px-4 py-3 bg-blue-600 text-white rounded-xl shadow-2xl text-sm animate-in slide-in-from-bottom-4 duration-300">
      <ArrowUpCircle size={16} className="flex-shrink-0" />
      <span>
        <strong>InfraPanel v{latestVersion}</strong> ist verfügbar
      </span>
      <a
        href="https://github.com/jnwrld999/infra-panel/releases/latest"
        target="_blank"
        rel="noopener noreferrer"
        onClick={dismiss}
        className="px-2 py-0.5 bg-white/20 hover:bg-white/30 rounded-md font-medium transition-colors"
      >
        Herunterladen
      </a>
      <button
        onClick={dismiss}
        className="p-0.5 hover:bg-white/20 rounded-md transition-colors"
        title="Schließen"
      >
        <X size={14} />
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Commit**
```bash
cd /home/juice/infra-panel
git add frontend/src/components/UpdateNotification.tsx
git commit -m "feat: add UpdateNotification toast for new version alerts"
```

---

## Task 3: Wire UpdateNotification into App.tsx, remove duplicate version check

**Files:**
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Read current App.tsx to confirm exact lines**

Current state in App.tsx:
- Line 6: `import { WhatsNewModal } from '@/components/WhatsNewModal'`
- Lines 39–58: version check `useEffect` with `fetch('/api/info')` and `setWhatsNew`
- Lines 78–83: `{whatsNew && <WhatsNewModal ... />}`

- [ ] **Step 2: Replace App.tsx with updated version**

```tsx
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
```

- [ ] **Step 3: Verify build passes**
```bash
cd /home/juice/infra-panel/frontend && npm run build 2>&1 | tail -5
```
Expected: `✓ built in`

- [ ] **Step 4: Commit**
```bash
cd /home/juice/infra-panel
git add frontend/src/App.tsx
git commit -m "feat: wire UpdateNotification, remove duplicate version check from App.tsx"
```

---

## Task 4: Create test GitHub release v1.3.0 so notification appears immediately

- [ ] **Step 1: Create release v1.3.0 on GitHub**
```bash
gh release create v1.3.0 \
  --repo jnwrld999/infra-panel \
  --title "InfraPanel v1.3.0" \
  --notes "## InfraPanel v1.3.0

### Verbesserungen
- Update-Mechanismus komplett überarbeitet
- Benachrichtigung bei neuer Version
- Toten Sync-Code aus TopBar entfernt
- Download-Button in Web-Ansicht" \
  --latest
```

- [ ] **Step 2: Clear localStorage cache so notification shows immediately**

Open browser devtools → Application → Local Storage → delete `infra-panel-gh-latest` and `infra-panel-notified-version`.

Or run in browser console:
```javascript
localStorage.removeItem('infra-panel-gh-latest')
localStorage.removeItem('infra-panel-notified-version')
location.reload()
```

- [ ] **Step 3: Push to GitHub**
```bash
cd /home/juice/infra-panel && git push origin master
```

- [ ] **Step 4: Verify notification appears**

Open http://localhost:3000 in browser (or restart Electron app). Within a few seconds the blue toast should appear bottom-right: `InfraPanel v1.3.0 ist verfügbar — Herunterladen`
