import { create } from 'zustand'
import axios from 'axios'

interface AuthUser {
  discord_id: string
  username: string
  role: string
  language: string
  is_owner: boolean
  avatar_url?: string | null
  assigned_bot?: { id: number; name: string } | null
}

export interface BotSummary {
  id: number
  name: string
  server_id: number | null
  restricted: boolean
}

interface AuthState {
  user: AuthUser | null
  loading: boolean
  prefetchedBots: BotSummary[] | null
  fetchMe: () => Promise<void>
  logout: () => Promise<void>
}

const LS_USER_KEY = 'infra-panel-user'

function loadCachedUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(LS_USER_KEY)
    return raw ? (JSON.parse(raw) as AuthUser) : null
  } catch {
    return null
  }
}

const _cached = loadCachedUser()

export const useAuthStore = create<AuthState>((set) => ({
  // If we have a cached user, show them immediately — no loading spinner
  user: _cached,
  loading: _cached === null,
  prefetchedBots: null,
  fetchMe: async () => {
    const doGet = () => axios.get<AuthUser>('/auth/me', { withCredentials: true })
    const prefetchBots = () =>
      axios.get<BotSummary[]>('/api/bots/', { withCredentials: true })
        .then((r) => set({ prefetchedBots: Array.isArray(r.data) ? r.data : null }))
        .catch(() => {})

    const applyUser = (data: AuthUser) => {
      try { localStorage.setItem(LS_USER_KEY, JSON.stringify(data)) } catch {}
      set({ user: data, loading: false })
      prefetchBots()
    }

    try {
      const resp = await doGet()
      applyUser(resp.data)
    } catch (e: any) {
      if (e.response?.status === 401) {
        // Access token expired — try to refresh silently
        try {
          await axios.post('/auth/refresh', {}, { withCredentials: true })
          const resp = await doGet()
          applyUser(resp.data)
        } catch {
          // Refresh token also invalid/expired — force login
          localStorage.removeItem(LS_USER_KEY)
          set({ user: null, loading: false })
        }
      } else {
        // Network/server error — keep cached user visible, stop loading
        set({ loading: false })
      }
    }
  },
  logout: async () => {
    try { await axios.post('/auth/logout', {}, { withCredentials: true }) } catch {}
    localStorage.removeItem(LS_USER_KEY)
    set({ user: null, prefetchedBots: null })
    window.location.href = '/login'
  },
}))
