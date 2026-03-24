import { create } from 'zustand'
import axios from 'axios'

interface AuthUser {
  discord_id: string
  username: string
  role: string
  language: string
  is_owner: boolean
}

interface AuthState {
  user: AuthUser | null
  loading: boolean
  fetchMe: () => Promise<void>
  logout: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,
  fetchMe: async () => {
    try {
      const resp = await axios.get('/auth/me', { withCredentials: true })
      set({ user: resp.data, loading: false })
    } catch {
      set({ user: null, loading: false })
    }
  },
  logout: async () => {
    await axios.post('/auth/logout', {}, { withCredentials: true })
    set({ user: null })
    window.location.href = '/login'
  },
}))
