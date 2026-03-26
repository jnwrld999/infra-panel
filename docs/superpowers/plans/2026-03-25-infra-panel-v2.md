# InfraPanel v2 — 21-Feature Overhaul

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement 21 improvements across auth, UI, server status, navigation, plugins, logging, themes, and app infrastructure.

**Architecture:** All frontend changes live in `/home/juice/infra-panel/frontend/src/`. Backend in `/home/juice/infra-panel/backend/`. Electron in `/home/juice/infra-panel/electron/`. Changes are grouped so each task touches non-overlapping files where possible. Tasks must be done sequentially when files overlap.

**Tech Stack:** React 18 + TypeScript + Vite + Tailwind CSS v4, FastAPI + SQLAlchemy + SQLite, Electron 28, Zustand (persist), i18next

---

## File Map

**Modified:**
- `frontend/src/components/Sidebar.tsx` — logout red, Discord user position, nav Services→Users
- `frontend/src/components/TopBar.tsx` — remove Discord user chip, update check, restart via IPC
- `frontend/src/index.css` — add 5 new themes (Dracula, Nord, Solarized Dark, Catppuccin, One Dark)
- `frontend/src/store/uiStore.ts` — extend Theme type, add `devMode`, `stayLoggedIn` fields
- `frontend/src/pages/Settings.tsx` — theme picker expansion, 30-day session toggle, dev mode toggle, changelog section
- `frontend/src/pages/Users.tsx` — full rewrite: table + detail view, role/permission management
- `frontend/src/pages/Plugins.tsx` — left nav (Minecraft/Discord), bot selector, cogs terminology
- `frontend/src/pages/Logs.tsx` — add log categories (System/Error/Sync/Audit/Dev), filter UI
- `frontend/src/pages/Sync.tsx` — add help/explanation panel
- `frontend/src/pages/Dashboard.tsx` — replace 'services' PanelType with 'users'
- `electron/main.ts` — IPC handler for full app restart
- `backend/api/auth.py` — 30-day refresh option based on `stay_logged_in` flag
- `backend/api/servers.py` — auto health-check on list, status → live/offline
- `backend/api/info.py` — expose latest version for update check
- `backend/db/models.py` — add `AuditLog` category field if missing
- `.env` — no change (JWT days stay configurable)

**Created:**
- `frontend/src/pages/Services.tsx` — delete (remove file)

---

## Task 1: Logout Button Red + Discord User Moved (#12, #13)

**Files:**
- Modify: `frontend/src/components/Sidebar.tsx`
- Modify: `frontend/src/components/TopBar.tsx`

- [ ] **Step 1: Make logout button red on hover in Sidebar.tsx**

Find the logout button (uses `LogOut` icon from lucide-react). Replace its className to add red hover:
```tsx
// Old pattern (something like):
className="... text-muted-foreground hover:text-foreground hover:bg-muted ..."
// New:
className="... text-muted-foreground hover:text-red-400 hover:bg-red-500/10 ..."
```

- [ ] **Step 2: Remove Discord user display from TopBar.tsx**

In `TopBar.tsx`, find and remove the block showing the Discord green dot + "Discord" text label (the `<Circle>` + `<span>Discord</span>` in the `ml-auto` section). The user info already lives in the Sidebar bottom section — no replacement needed in TopBar.

- [ ] **Step 3: Verify visually**

Start app, check: logout is red on hover, TopBar no longer shows "Discord" chip.

- [ ] **Step 4: Commit**
```bash
git -C /home/juice/infra-panel add frontend/src/components/Sidebar.tsx frontend/src/components/TopBar.tsx
git -C /home/juice/infra-panel commit -m "feat: logout red on hover, remove Discord chip from TopBar"
```

---

## Task 2: Five New Themes (#8)

**Files:**
- Modify: `frontend/src/index.css`
- Modify: `frontend/src/store/uiStore.ts`
- Modify: `frontend/src/pages/Settings.tsx`

- [ ] **Step 1: Add theme CSS variables in index.css**

After the existing `[data-theme="monokai"]` block, add:

```css
[data-theme="dracula"] {
  --background: #282a36;
  --foreground: #f8f8f2;
  --card: #21222c;
  --card-foreground: #f8f8f2;
  --border: #44475a;
  --muted: #44475a;
  --muted-foreground: #6272a4;
  --primary: #bd93f9;
  --primary-foreground: #282a36;
  --secondary: #44475a;
  --secondary-foreground: #f8f8f2;
  --destructive: #ff5555;
  --accent: #ff79c6;
}

[data-theme="nord"] {
  --background: #2e3440;
  --foreground: #eceff4;
  --card: #3b4252;
  --card-foreground: #eceff4;
  --border: #4c566a;
  --muted: #434c5e;
  --muted-foreground: #9099a8;
  --primary: #88c0d0;
  --primary-foreground: #2e3440;
  --secondary: #434c5e;
  --secondary-foreground: #eceff4;
  --destructive: #bf616a;
  --accent: #81a1c1;
}

[data-theme="solarized"] {
  --background: #002b36;
  --foreground: #839496;
  --card: #073642;
  --card-foreground: #93a1a1;
  --border: #134f5a;
  --muted: #073642;
  --muted-foreground: #657b83;
  --primary: #268bd2;
  --primary-foreground: #fdf6e3;
  --secondary: #073642;
  --secondary-foreground: #93a1a1;
  --destructive: #dc322f;
  --accent: #2aa198;
}

[data-theme="catppuccin"] {
  --background: #1e1e2e;
  --foreground: #cdd6f4;
  --card: #181825;
  --card-foreground: #cdd6f4;
  --border: #45475a;
  --muted: #313244;
  --muted-foreground: #7f849c;
  --primary: #cba6f7;
  --primary-foreground: #1e1e2e;
  --secondary: #313244;
  --secondary-foreground: #cdd6f4;
  --destructive: #f38ba8;
  --accent: #89dceb;
}

[data-theme="onedark"] {
  --background: #21252b;
  --foreground: #abb2bf;
  --card: #282c34;
  --card-foreground: #abb2bf;
  --border: #3e4451;
  --muted: #2c313a;
  --muted-foreground: #5c6370;
  --primary: #61afef;
  --primary-foreground: #21252b;
  --secondary: #2c313a;
  --secondary-foreground: #abb2bf;
  --destructive: #e06c75;
  --accent: #56b6c2;
}
```

- [ ] **Step 2: Extend Theme type in uiStore.ts**

```ts
// Old:
type Theme = 'dark' | 'light' | 'monokai'
// New:
type Theme = 'dark' | 'light' | 'monokai' | 'dracula' | 'nord' | 'solarized' | 'catppuccin' | 'onedark'
```

Also export the type: `export type Theme = ...`

- [ ] **Step 3: Expand THEME_PREVIEWS in Settings.tsx**

```tsx
const THEME_PREVIEWS: Record<Theme, { bg: string; card: string; primary: string; label: string }> = {
  dark:       { bg: '#0b1120', card: '#0d1526', primary: '#3b82f6', label: 'Dark' },
  light:      { bg: '#f9fafb', card: '#ffffff', primary: '#3b82f6', label: 'Light' },
  monokai:    { bg: '#272822', card: '#2d2e2a', primary: '#a6e22e', label: 'Monokai' },
  dracula:    { bg: '#282a36', card: '#21222c', primary: '#bd93f9', label: 'Dracula' },
  nord:       { bg: '#2e3440', card: '#3b4252', primary: '#88c0d0', label: 'Nord' },
  solarized:  { bg: '#002b36', card: '#073642', primary: '#268bd2', label: 'Solarized' },
  catppuccin: { bg: '#1e1e2e', card: '#181825', primary: '#cba6f7', label: 'Catppuccin' },
  onedark:    { bg: '#21252b', card: '#282c34', primary: '#61afef', label: 'One Dark' },
}
```

Change the grid to `grid-cols-4` (was 3) so 8 themes fit in two rows.

- [ ] **Step 4: Update FOUC script in index.html**

The inline script that reads `infra-panel-ui` and sets `data-theme` works on any string value already — no change needed as long as the CSS variables exist.

- [ ] **Step 5: Commit**
```bash
git -C /home/juice/infra-panel add frontend/src/index.css frontend/src/store/uiStore.ts frontend/src/pages/Settings.tsx
git -C /home/juice/infra-panel commit -m "feat: add 5 new themes (Dracula, Nord, Solarized, Catppuccin, One Dark)"
```

---

## Task 3: Server Status Live / Offline (#2, #19)

**Files:**
- Modify: `backend/api/servers.py`
- Modify: `backend/services/health_service.py` (or equivalent)
- Modify: `frontend/src/pages/Servers.tsx`

- [ ] **Step 1: Check what `check_server_health` already does**

Read `backend/services/health_service.py`. It likely does an SSH connect test and updates `server.status`. The status values in DB are free-form strings.

- [ ] **Step 2: Standardise status values in backend**

Read `backend/services/health_service.py` first. The function signature is:
`async def check_server_health(server: Server, db: Session)` — takes ORM object + session, not just an ID.

Find where `server.status` is written. There are typically three branches — ensure all three are covered:
```python
server.status = "online"   # success branch
server.status = "offline"  # connection failure branch
server.status = "offline"  # exception/error branch  ← also fix this one
```
This removes the `"error"` status entirely so the frontend STATUS map covers all cases.

- [ ] **Step 3: Auto-trigger health check on server list**

`check_server_health` takes `(server: Server, db: Session)`. Read the existing `list_servers` function — `BackgroundTasks` is already imported. Add it as a param and call correctly:
```python
from datetime import datetime, timezone, timedelta

@router.get("/")
def list_servers(
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: DiscordUser = Depends(get_current_user),
):
    servers = db.query(Server).all()
    stale_threshold = datetime.now(timezone.utc) - timedelta(minutes=2)
    for s in servers:
        if s.last_checked is None or s.last_checked < stale_threshold:
            background_tasks.add_task(check_server_health, s, db)  # pass ORM object + db
    return [_server_to_dict(s) for s in servers]
```

- [ ] **Step 4: Update Servers.tsx status badge**

Find the status badge rendering. Replace:
```tsx
// Old: shows "unknown" / generic
// New status map:
const STATUS = {
  online:  { label: 'Live',    dot: 'bg-green-400',  text: 'text-green-400' },
  offline: { label: 'Offline', dot: 'bg-red-400',    text: 'text-red-400'  },
  unknown: { label: 'Prüfe…',  dot: 'bg-yellow-400 animate-pulse', text: 'text-yellow-400' },
}
const s = STATUS[server.status as keyof typeof STATUS] ?? STATUS.unknown
```

Render as:
```tsx
<span className={`flex items-center gap-1.5 text-xs font-medium ${s.text}`}>
  <span className={`w-2 h-2 rounded-full ${s.dot}`} />
  {s.label}
</span>
```

- [ ] **Step 5: Poll server status every 30s**

In `Servers.tsx`, add a `useEffect` that calls `loadServers()` every 30 seconds using `setInterval`, clearing on unmount.

- [ ] **Step 6: Commit**
```bash
git -C /home/juice/infra-panel add backend/ frontend/src/pages/Servers.tsx
git -C /home/juice/infra-panel commit -m "feat: server status Live/Offline with auto health-check"
```

---

## Task 4: Services → Users Page (#4)

**Files:**
- Modify: `frontend/src/components/Sidebar.tsx` (nav item)
- Modify: `frontend/src/pages/Users.tsx` (full rewrite)
- Modify: `frontend/src/pages/Dashboard.tsx` (remove 'services' panel)
- Modify: `frontend/src/store/uiStore.ts` (PanelType)
- Delete: `frontend/src/pages/Services.tsx` (or leave as redirect)

- [ ] **Step 1: Update PanelType in uiStore.ts**
```ts
// Old:
export type PanelType = 'servers' | 'approvals' | 'errors' | 'sync' | 'services'
// New:
export type PanelType = 'servers' | 'approvals' | 'errors' | 'sync' | 'users'
```

- [ ] **Step 2: Replace Services with Users in Sidebar nav**

In `Sidebar.tsx`, find the nav array/items. Replace `{ path: '/services', label: 'Services', icon: ... }` with:
```tsx
{ path: '/users', label: 'Users', icon: Users }  // import Users from 'lucide-react'
```

- [ ] **Step 3: Clean up App.tsx**

Read `frontend/src/App.tsx`. Both `/services` and `/users` routes already exist. Do the following:
- Remove the `<Route path="/services" ...>` entry entirely
- Remove the `import Services from './pages/Services'` (or equivalent) import
- The `/users` → `Users` route should already be present — verify it is, do not add a duplicate
- Optionally delete `frontend/src/pages/Services.tsx` since it's no longer routed

- [ ] **Step 4: Rewrite Users.tsx**

Complete rewrite — table of all discord users, detail panel on click, role/permission editing:

```tsx
import { useEffect, useState } from 'react'
import { Shield, Check, X, ChevronRight, User } from 'lucide-react'
import client from '@/api/client'

interface DiscordUser {
  id: number; discord_id: string; username: string
  role: string; verified: boolean; active: boolean
  added_by?: string; added_at?: string; last_action?: string
}

const ROLES = ['owner', 'admin', 'moderator', 'viewer']
const ROLE_COLORS: Record<string, string> = {
  owner:     'bg-red-500/15 text-red-400',
  admin:     'bg-purple-500/15 text-purple-400',
  moderator: 'bg-blue-500/15 text-blue-400',
  viewer:    'bg-muted text-muted-foreground',
}

export default function Users() {
  const [users, setUsers] = useState<DiscordUser[]>([])
  const [selected, setSelected] = useState<DiscordUser | null>(null)
  const [loading, setLoading] = useState(true)

  const load = () => {
    setLoading(true)
    client.get<DiscordUser[]>('/users/').then(r => {
      setUsers(r.data); setLoading(false)
    }).catch(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const updateUser = (id: number, patch: Partial<DiscordUser>) => {
    client.patch(`/users/${id}`, patch).then(() => {
      setUsers(prev => prev.map(u => u.id === id ? { ...u, ...patch } : u))
      setSelected(prev => prev?.id === id ? { ...prev, ...patch } : prev)
    })
  }

  return (
    <div className="flex h-full gap-6">
      {/* Table */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-foreground">Nutzer</h2>
          <span className="text-sm text-muted-foreground">{users.length} Nutzer</span>
        </div>
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
                  onClick={() => setSelected(u)}
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
                    <span className={`text-xs ${u.active ? 'text-green-400' : 'text-red-400'}`}>
                      {u.active ? 'Aktiv' : 'Gesperrt'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <ChevronRight size={14} className="text-muted-foreground inline" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail panel */}
      {selected && (
        <div className="w-72 flex-shrink-0 bg-card border border-border rounded-xl p-5 space-y-5 self-start">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-semibold text-foreground">{selected.username}</p>
              <p className="text-xs text-muted-foreground font-mono mt-0.5">{selected.discord_id}</p>
            </div>
            <button onClick={() => setSelected(null)} className="p-1 rounded hover:bg-muted text-muted-foreground">
              <X size={14} />
            </button>
          </div>

          {/* Role */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Rolle</label>
            <div className="flex flex-col gap-1">
              {ROLES.map(r => (
                <button key={r} onClick={() => updateUser(selected.id, { role: r })}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                    selected.role === r ? 'bg-primary/10 text-primary border border-primary/30' : 'hover:bg-muted text-muted-foreground'
                  }`}>
                  <span>{r}</span>
                  {selected.role === r && <Check size={13} />}
                </button>
              ))}
            </div>
          </div>

          {/* Toggles */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-foreground">Verifiziert</span>
              <button onClick={() => updateUser(selected.id, { verified: !selected.verified })}
                className={`w-10 h-5 rounded-full transition-colors relative ${selected.verified ? 'bg-primary' : 'bg-muted'}`}>
                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${selected.verified ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-foreground">Aktiv</span>
              <button onClick={() => updateUser(selected.id, { active: !selected.active })}
                className={`w-10 h-5 rounded-full transition-colors relative ${selected.active ? 'bg-primary' : 'bg-muted'}`}>
                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${selected.active ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </div>
          </div>

          {selected.added_at && (
            <p className="text-xs text-muted-foreground">Hinzugefügt: {new Date(selected.added_at).toLocaleDateString('de-DE')}</p>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 5: Add PATCH /api/users/{id} endpoint in backend**

In `backend/api/users.py` (create or extend):
```python
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session
from backend.db.session import get_db
from backend.db.models import DiscordUser
from backend.api.deps import get_current_user, require_admin

router = APIRouter(prefix="/api/users", tags=["users"])

class UserPatch(BaseModel):
    role: Optional[str] = None
    verified: Optional[bool] = None
    active: Optional[bool] = None

@router.get("/")
def list_users(db: Session = Depends(get_db), current_user: DiscordUser = Depends(get_current_user)):
    users = db.query(DiscordUser).all()
    return [
        {"id": u.id, "discord_id": u.discord_id, "username": u.username,
         "role": u.role, "verified": u.verified, "active": u.active,
         "added_by": u.added_by,
         "added_at": u.added_at.isoformat() if u.added_at else None,
         "last_action": u.last_action.isoformat() if u.last_action else None}
        for u in users
    ]

@router.patch("/{user_id}")
def update_user(user_id: int, patch: UserPatch,
                db: Session = Depends(get_db),
                current_user: DiscordUser = Depends(require_admin)):
    user = db.query(DiscordUser).filter(DiscordUser.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if patch.role is not None:
        user.role = patch.role
    if patch.verified is not None:
        user.verified = patch.verified
    if patch.active is not None:
        user.active = patch.active
    db.commit()
    return {"ok": True}
```

Note: `users.router` is already registered in `backend/main.py` (line ~51). Do NOT add it again — duplicate registration causes a FastAPI startup error. Just verify it's there.

- [ ] **Step 6: Dashboard — replace 'services' with 'users'**

In `Dashboard.tsx`, find all references to `'services'` PanelType and replace with `'users'`. Update the panel render switch/map to show a Users summary panel instead of Services.

- [ ] **Step 7: Commit**
```bash
git -C /home/juice/infra-panel add frontend/src/ backend/api/users.py backend/main.py
git -C /home/juice/infra-panel commit -m "feat: replace Services with Users page — role/permission management"
```

---

## Task 5: Plugin View Restructure + Cogs Terminology (#5, #6)

**Files:**
- Modify: `frontend/src/pages/Plugins.tsx`

- [ ] **Step 1: Add left category nav state**

Add state at top of component:
```tsx
const [category, setCategory] = useState<'minecraft' | 'discord'>('minecraft')
const [selectedBotId, setSelectedBotId] = useState<number | null>(null)
```

Remove the existing `tab` state (was doing the same thing).

- [ ] **Step 2: Add view mode toggle (grid vs list)**

Add to uiStore:
```ts
pluginView: 'list' | 'grid'
setPluginView: (v: 'list' | 'grid') => void
// default: 'list'
```

- [ ] **Step 3: Restructure layout to 3-column nav**

Replace the tabs with a left sidebar nav:
```tsx
<div className="flex gap-6">
  {/* Left nav */}
  <div className="w-44 flex-shrink-0 space-y-1">
    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-2 mb-2">Kategorie</p>
    {(['minecraft', 'discord'] as const).map(cat => (
      <button key={cat} onClick={() => { setCategory(cat); setSelectedBotId(null) }}
        className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
          category === cat ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
        }`}>
        {cat === 'minecraft' ? '⛏ Minecraft' : '🤖 Discord Bots'}
      </button>
    ))}

    {category === 'discord' && botConfigs.length > 0 && (
      <>
        <div className="h-px bg-border my-2" />
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-2 mb-2">Bot wählen</p>
        {botConfigs.map(b => (
          <button key={b.botId} onClick={() => setSelectedBotId(b.botId)}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm truncate transition-colors ${
              selectedBotId === b.botId ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}>
            {b.botName}
          </button>
        ))}
      </>
    )}
  </div>

  {/* Main content */}
  <div className="flex-1 min-w-0">
    {category === 'minecraft' && /* existing minecraft panel code */ }
    {category === 'discord' && selectedBotId === null && (
      <div className="text-center text-sm text-muted-foreground py-20">
        ← Bot aus der Liste auswählen
      </div>
    )}
    {category === 'discord' && selectedBotId !== null && /* show single bot panel */ }
  </div>
</div>
```

- [ ] **Step 4: Rename "Plugins" → "Cogs" in Discord bot section**

In the Discord bot panel, change all labels:
- "Laden" button title: "Cogs laden"
- Empty state: `Noch nicht geladen — klicke "Cogs laden"`
- Column/section heading: "Cogs" instead of "Plugins"
- File viewer modal title: Shows "Cog: {name}" for Discord bots

- [ ] **Step 5: Add grid/list view toggle**

In the header row of the main content area, add toggle buttons:
```tsx
import { List, LayoutGrid } from 'lucide-react'
const { pluginView, setPluginView } = useUIStore()

// Toggle buttons:
<div className="flex gap-1 p-0.5 bg-muted rounded-lg">
  <button onClick={() => setPluginView('list')} className={`p-1.5 rounded-md transition-colors ${pluginView === 'list' ? 'bg-card shadow-sm' : 'text-muted-foreground'}`}>
    <List size={14} />
  </button>
  <button onClick={() => setPluginView('grid')} className={`p-1.5 rounded-md transition-colors ${pluginView === 'grid' ? 'bg-card shadow-sm' : 'text-muted-foreground'}`}>
    <LayoutGrid size={14} />
  </button>
</div>
```

For grid view, render plugins/cogs as cards in `grid grid-cols-2 gap-3` instead of a list.

- [ ] **Step 6: Commit**
```bash
git -C /home/juice/infra-panel add frontend/src/pages/Plugins.tsx frontend/src/store/uiStore.ts
git -C /home/juice/infra-panel commit -m "feat: plugin view restructure — left nav, bot selector, grid/list, cogs terminology"
```

---

## Task 6: 30-Day Session Toggle (#1)

**Files:**
- Modify: `frontend/src/pages/Settings.tsx`
- Modify: `frontend/src/store/uiStore.ts`
- Modify: `backend/api/auth.py`

- [ ] **Step 1: Add stayLoggedIn to uiStore**
```ts
stayLoggedIn: boolean
setStayLoggedIn: (v: boolean) => void
// default: false
```

- [ ] **Step 2: Add toggle in Settings.tsx**

In the About/Session section (or a new "Sicherheit" section):
```tsx
<section className="bg-card border border-border rounded-xl p-5">
  <h3 className="font-semibold text-foreground mb-4">Sicherheit</h3>
  <div className="flex items-center justify-between">
    <div>
      <p className="text-sm text-foreground">30 Tage angemeldet bleiben</p>
      <p className="text-xs text-muted-foreground mt-0.5">Session verlängert sich automatisch auf 30 Tage</p>
    </div>
    <button onClick={() => setStayLoggedIn(!stayLoggedIn)}
      className={`w-10 h-5 rounded-full transition-colors relative flex-shrink-0 ${stayLoggedIn ? 'bg-primary' : 'bg-muted'}`}>
      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${stayLoggedIn ? 'translate-x-5' : 'translate-x-0.5'}`} />
    </button>
  </div>
  {stayLoggedIn && (
    <p className="mt-2 text-xs text-primary/80 flex items-center gap-1">
      <Check size={11} /> Aktiv — Session läuft 30 Tage
    </p>
  )}
</section>
```

- [ ] **Step 3: Pass preference to login endpoint**

In the Discord OAuth callback (the page that handles `/auth/discord/callback`), read `stayLoggedIn` from localStorage/store and pass as a `stay` query param. Or simpler: read it in the backend from a cookie set before login.

Simplest approach: in `backend/api/auth.py` discord callback, check for a `?stay=1` param or a `stay_logged_in` cookie. If present, set refresh token max_age to 30 days:

```python
stay = request.query_params.get("stay") == "1" or request.cookies.get("stay_logged_in") == "1"
refresh_max_age = 30 * 86400 if stay else settings.jwt_refresh_token_expire_days * 86400

response.set_cookie("refresh_token", refresh_token,
    httponly=True, secure=secure, samesite="lax",
    max_age=refresh_max_age)
```

In `frontend/src/store/authStore.ts` or login trigger, set `document.cookie = "stay_logged_in=1; path=/"` before redirecting to Discord OAuth if `stayLoggedIn` is true.

- [ ] **Step 4: Show session status in Settings**

After the backend returns user info, show when the session expires. This can be approximated from the JWT exp claim if exposed, or just shown as "aktiv (30 Tage)" / "aktiv (7 Tage)".

- [ ] **Step 5: Commit**
```bash
git -C /home/juice/infra-panel add frontend/src/ backend/api/auth.py
git -C /home/juice/infra-panel commit -m "feat: 30-day stay-logged-in session option"
```

---

## Task 7: Real App Restart via Electron IPC (#9)

**Files:**
- Modify: `electron/main.ts`
- Modify: `frontend/src/components/TopBar.tsx`

- [ ] **Step 1: Add IPC handler in electron/main.ts**

```ts
import { app, BrowserWindow, ipcMain } from 'electron'

// In app.whenReady():
ipcMain.on('app:restart', () => {
  app.relaunch()
  app.exit(0)
})
```

- [ ] **Step 2: Add restart to existing preload**

`electron/preload.ts` already exists and exposes a `window.infraPanel` object via `contextBridge.exposeInMainWorld('infraPanel', {...})`. Do NOT replace it — merge the restart function into the existing exposed object:

```ts
// Find the existing exposeInMainWorld call and add `restart` to the object:
contextBridge.exposeInMainWorld('infraPanel', {
  // ... existing properties ...
  restart: () => ipcRenderer.send('app:restart'),
})
```

Also verify `electron/main.ts` already has `preload: path.join(__dirname, 'preload.js')` in BrowserWindow's `webPreferences`. If not, add it.

Update `electron/tsconfig.json` to include `preload.ts` in compilation if it isn't already.

- [ ] **Step 3: Update type declaration for window.infraPanel**

Read `frontend/src/global.d.ts` (or similar type declaration file). It declares `window.infraPanel`. Add `restart` to it:
```ts
interface Window {
  infraPanel?: {
    // ... existing fields ...
    restart?: () => void
  }
}
```

- [ ] **Step 4: Update TopBar.tsx restart button**

```tsx
const handleRestart = () => {
  if (window.infraPanel?.restart) {
    window.infraPanel.restart()
  } else {
    window.location.reload()  // fallback for browser dev mode
  }
}

// In JSX:
<button onClick={handleRestart} ...>
  <RotateCcw size={12} />
  Neu starten
</button>
```

- [ ] **Step 5: Rebuild Electron**
```bash
cd /home/juice/infra-panel/electron && npm run build
```

- [ ] **Step 6: Commit**
```bash
git -C /home/juice/infra-panel add electron/ frontend/src/components/TopBar.tsx frontend/src/electron.d.ts
git -C /home/juice/infra-panel commit -m "feat: real app restart via Electron IPC relaunch"
```

---

## Task 8: Plugins Auto-Load (#10)

**Files:**
- Modify: `frontend/src/pages/Plugins.tsx`

- [ ] **Step 1: Auto-load Minecraft plugins when servers are loaded**

In the `useEffect` that fetches servers, immediately trigger `loadPluginsForServer` for each server after configs are set:
```tsx
useEffect(() => {
  client.get<Server[]>('/servers/').then((r) => {
    const savedPaths = getSavedPaths()
    const newConfigs = r.data.map((s) => ({
      serverId: s.id, serverName: s.name,
      path: savedPaths[String(s.id)] || '/opt/minecraft/plugins',
      plugins: [], loading: false,
    }))
    setConfigs(newConfigs)
    // Auto-load immediately
    newConfigs.forEach(c => loadPluginsForServer(c.serverId, c.path))
  }).catch(() => {})
}, [])
```

- [ ] **Step 2: Auto-load Discord cogs when bot is selected**

When `selectedBotId` changes and a bot is selected, immediately load its cogs if not already loaded:
```tsx
useEffect(() => {
  if (selectedBotId !== null) {
    const config = botConfigs.find(c => c.botId === selectedBotId)
    if (config && config.cogs.length === 0 && !config.loading) {
      loadCogsForBot(selectedBotId)
    }
  }
}, [selectedBotId])
```

- [ ] **Step 3: Commit**
```bash
git -C /home/juice/infra-panel add frontend/src/pages/Plugins.tsx
git -C /home/juice/infra-panel commit -m "feat: plugins auto-load on open and bot selection"
```

---

## Task 9: Update Check Button (#11)

**Files:**
- Modify: `frontend/src/components/TopBar.tsx`
- Modify: `backend/api/info.py`

- [ ] **Step 1: Add latest_version to info endpoint**

In `backend/api/info.py`, try to read a `LATEST_VERSION` env var or from a local `LATEST` file. For now, hardcode or expose current version. Real update check would query GitHub releases — add as a future enhancement. For now, expose the current version and show an "Updates prüfen" button:

```python
@router.get("/info")
async def get_info():
    import os
    return {
        "name": "InfraPanel",
        "version": __version__,
        "build_date": BUILD_DATE,
        "environment": os.getenv("ENVIRONMENT", "development"),
        "latest_version": os.getenv("LATEST_VERSION", __version__),  # same = no update
    }
```

- [ ] **Step 2: Add update check UI in TopBar.tsx**

Replace the existing version/update badge with a clickable check:
```tsx
const [checking, setChecking] = useState(false)

const checkForUpdates = () => {
  setChecking(true)
  client.get<AppInfo>('/info').then(r => {
    setInfo(r.data)
    const seen = localStorage.getItem(SEEN_VERSION_KEY)
    if (seen && seen !== r.data.version) setUpdateAvailable(true)
    else if (r.data.latest_version && r.data.latest_version !== r.data.version) setUpdateAvailable(true)
    setChecking(false)
  }).catch(() => setChecking(false))
}
```

Add a refresh icon button next to the version badge that calls `checkForUpdates()`.

- [ ] **Step 3: Commit**
```bash
git -C /home/juice/infra-panel add frontend/src/components/TopBar.tsx backend/api/info.py
git -C /home/juice/infra-panel commit -m "feat: update check button in TopBar"
```

---

## Task 10: Changelog / Version History in Settings (#17)

**Files:**
- Modify: `frontend/src/pages/Settings.tsx`
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Add CHANGELOG entries**

`/home/juice/infra-panel/CHANGELOG.md` already exists. Prepend (add at the top) the v1.0.0 entry if it is not already present. Do not overwrite existing content:
```markdown
# Changelog

## v1.0.0 — 2026-03-25
### Neu
- Discord OAuth2 Login
- Server-Verwaltung mit SSH
- Plugin-Übersicht für Minecraft und Discord-Bots
- Bot-Verwaltung
- Dashboard mit anpassbaren Panels
- Dark / Light / Monokai Themes
- Sidebar kollabierbar + skalierbar
- Mehrsprachig (DE/EN)
```

- [ ] **Step 2: Add changelog section in Settings.tsx**

Add a new `section` below the About section:
```tsx
const CHANGELOG = [
  {
    version: '1.0.0', date: '2026-03-25',
    changes: [
      'Discord OAuth2 Login',
      'Server-Verwaltung mit SSH',
      'Plugin-Übersicht für Minecraft und Discord-Bots',
      'Bot-Verwaltung', 'Dashboard mit anpassbaren Panels',
      'Dark / Light / Monokai Themes',
    ]
  }
]

<section className="bg-card border border-border rounded-xl p-5">
  <h3 className="font-semibold text-foreground mb-4">Versionsverlauf</h3>
  <div className="space-y-4">
    {CHANGELOG.map(entry => (
      <div key={entry.version}>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm font-mono font-medium text-foreground">v{entry.version}</span>
          <span className="text-xs text-muted-foreground">{entry.date}</span>
        </div>
        <ul className="space-y-1">
          {entry.changes.map((c, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
              <span className="text-primary mt-0.5">•</span>{c}
            </li>
          ))}
        </ul>
      </div>
    ))}
  </div>
</section>
```

- [ ] **Step 3: Commit**
```bash
git -C /home/juice/infra-panel add frontend/src/pages/Settings.tsx CHANGELOG.md
git -C /home/juice/infra-panel commit -m "feat: changelog / version history in Settings"
```

---

## Task 11: Sync Explanation Panel (#3)

**Files:**
- Modify: `frontend/src/pages/Sync.tsx`

- [ ] **Step 1: Add help/info section at top of Sync.tsx**

Add a collapsible info card that explains what sync does:
```tsx
const [helpOpen, setHelpOpen] = useState(false)

<div className="mb-6 bg-blue-500/10 border border-blue-500/20 rounded-xl overflow-hidden">
  <button onClick={() => setHelpOpen(v => !v)}
    className="w-full flex items-center justify-between px-5 py-3 text-sm font-medium text-blue-400">
    <div className="flex items-center gap-2">
      <Info size={14} />
      Was macht Sync?
    </div>
    <ChevronDown size={14} className={`transition-transform ${helpOpen ? 'rotate-180' : ''}`} />
  </button>
  {helpOpen && (
    <div className="px-5 pb-4 text-sm text-muted-foreground space-y-3 border-t border-blue-500/20">
      <p><strong className="text-foreground">Was wird synchronisiert?</strong><br />
        Server-Konfigurationen, Plugin-Listen, Bot-Status und Metadaten werden vom Server abgerufen und lokal gespeichert.</p>
      <p><strong className="text-foreground">Richtung</strong><br />
        Sync ist hauptsächlich Pull: Server → App. Push (App → Server) ist nur für explizite Aktionen vorgesehen.</p>
      <p><strong className="text-foreground">Risiken</strong><br />
        Ein fehlerhafter Sync kann veraltete Daten einblenden. Niemals während laufendem Minecraft-Neustart synchronisieren.</p>
      <p><strong className="text-foreground">Empfohlene Update-Strategie</strong></p>
      <ol className="list-decimal list-inside space-y-1 text-xs">
        <li>Erst Dry-Run / Status-Check durchführen</li>
        <li>Server-Backup anlegen</li>
        <li>Gezielten Sync starten (nicht alles auf einmal)</li>
        <li>Logs prüfen, bevor weitergemacht wird</li>
      </ol>
    </div>
  )}
</div>
```

- [ ] **Step 2: Commit**
```bash
git -C /home/juice/infra-panel add frontend/src/pages/Sync.tsx
git -C /home/juice/infra-panel commit -m "feat: sync explanation panel with update strategy guide"
```

---

## Task 12: Logging — Categories + Dev Mode (#7)

**Files:**
- Modify: `frontend/src/pages/Logs.tsx`
- Modify: `frontend/src/store/uiStore.ts`
- Modify: `frontend/src/pages/Settings.tsx`

- [ ] **Step 1: Add devMode to uiStore**
```ts
devMode: boolean
setDevMode: (v: boolean) => void
// default: false
```

- [ ] **Step 2: Add Dev Mode toggle in Settings.tsx**

In a new "Entwickler" section:
```tsx
<section className="bg-card border border-border rounded-xl p-5">
  <h3 className="font-semibold text-foreground mb-4">Entwickler</h3>
  <div className="flex items-center justify-between">
    <div>
      <p className="text-sm text-foreground">Dev-Modus</p>
      <p className="text-xs text-muted-foreground mt-0.5">Zusätzliche Logs: Button-Klicks, API-Calls, UI-Events</p>
    </div>
    <button onClick={() => setDevMode(!devMode)} ...>...</button>
  </div>
  {devMode && (
    <div className="mt-3 flex items-center gap-2 text-xs text-yellow-400 bg-yellow-500/10 rounded-lg px-3 py-2">
      <AlertTriangle size={12} />
      Dev-Modus aktiv — mehr Daten werden protokolliert
    </div>
  )}
</section>
```

- [ ] **Step 3: Rewrite Logs.tsx with 5 log categories**

```tsx
type LogCategory = 'system' | 'error' | 'sync' | 'audit' | 'dev'

const CATEGORIES: { key: LogCategory; label: string; color: string }[] = [
  { key: 'system', label: 'System',  color: 'text-muted-foreground' },
  { key: 'error',  label: 'Fehler',  color: 'text-red-400' },
  { key: 'sync',   label: 'Sync',    color: 'text-blue-400' },
  { key: 'audit',  label: 'Audit',   color: 'text-purple-400' },
  { key: 'dev',    label: 'Dev',     color: 'text-yellow-400' },
]
```

Layout: left category nav + main log list. Filter API calls:
- System: `GET /logs/?level=INFO`
- Error: `GET /logs/?level=ERROR`
- Sync: `GET /logs/?category=sync`
- Audit: `GET /audit-logs/` or `GET /logs/?category=audit`
- Dev: client-side only (button clicks logged to sessionStorage, displayed inline)

For Dev logs, add a `devLog(action, detail)` utility. First create the directory:
```bash
mkdir -p /home/juice/infra-panel/frontend/src/lib
```

```ts
// frontend/src/lib/devLog.ts
export function devLog(action: string, detail?: string) {
  const entry = { t: new Date().toISOString(), action, detail }
  const existing = JSON.parse(sessionStorage.getItem('dev-logs') || '[]')
  existing.push(entry)
  sessionStorage.setItem('dev-logs', JSON.stringify(existing.slice(-200)))
}
```

- [ ] **Step 4: Commit**
```bash
git -C /home/juice/infra-panel add frontend/src/pages/Logs.tsx frontend/src/pages/Settings.tsx frontend/src/store/uiStore.ts frontend/src/lib/devLog.ts
git -C /home/juice/infra-panel commit -m "feat: log categories (System/Error/Sync/Audit/Dev) + dev mode toggle"
```

---

## Phase 2 Items (Tracked — Not in this plan)

These items require additional design decisions, external dependencies, or significant architecture work. Each should become its own plan:

- **#14 — Account switcher**: Multi-account OAuth flow, stored accounts in encrypted localStorage/keychain. Requires multi-session backend support.
- **#15 — Windows build**: `electron-builder` config for NSIS installer, `package.json` build targets, CI pipeline. Straightforward but separate from feature work.
- **#16 — App icon**: SVG/PNG icon asset + `electron-builder` icon config. Can be done quickly once art is ready.
- **#18 — DSGVO**: Data audit, export endpoint (`GET /api/me/export`), delete endpoint (`DELETE /api/me`), privacy notice UI. Needs legal review of what's stored.
- **#20 — Feature requests**: New DB model `FeatureRequest`, CRUD backend, frontend page. Low complexity — can be added to a Phase 1b plan.
- **#21 — Discord DM integration**: Requires a running Discord bot, webhook or DM listener, async task queue. High complexity — separate plan.

---

## Execution Notes

- Run `cd /home/juice/infra-panel/electron && npm run build` after any Electron changes
- Frontend auto-reloads via Vite HMR — no restart needed for frontend-only changes
- Backend: `kill $(pgrep -f uvicorn) && uvicorn backend.main:app --reload --port 8000 &` for backend changes
- Full app restart: `kill $(cat /tmp/infra-panel.pid) && npm start &` from electron dir
- Test auth changes: must log out and back in (cookies)
- DB schema changes: run migration or recreate (SQLite, dev mode — `alembic upgrade head` or manual SQL)
