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

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,
  prefetchedBots: null,
  fetchMe: async () => {
    try {
      const resp = await axios.get('/auth/me', { withCredentials: true })
      set({ user: resp.data, loading: false })
      // Prefetch bots in background so Plugins page isn't empty on first visit
      axios.get<BotSummary[]>('/bots/', { withCredentials: true })
        .then((r) => set({ prefetchedBots: r.data }))
        .catch(() => {})
    } catch {
      set({ user: null, loading: false })
    }
  },
  logout: async () => {
    await axios.post('/auth/logout', {}, { withCredentials: true })
    set({ user: null, prefetchedBots: null })
    window.location.href = '/login'
  },
}))
