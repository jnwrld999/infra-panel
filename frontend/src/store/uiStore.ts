import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Theme = 'dark' | 'light' | 'monokai' | 'dracula' | 'nord' | 'solarized' | 'catppuccin' | 'onedark'
type FontSize = 'small' | 'normal' | 'large'

export type PanelType = 'servers' | 'approvals' | 'errors' | 'users'

interface UIState {
  theme: Theme
  fontSize: FontSize
  sidebarCollapsed: boolean
  sidebarWidth: number        // pixels, default 224 (w-56)
  dashboardPanels: PanelType[]
  pluginView: 'list' | 'grid'
  devMode: boolean
  lastReload: Date | null
  previewUser: {
    discord_id: string
    username: string
    role: string
    assigned_bot: { id: number; name: string } | null
  } | null
  setTheme: (t: Theme) => void
  setFontSize: (s: FontSize) => void
  setSidebarCollapsed: (v: boolean) => void
  setSidebarWidth: (w: number) => void
  setDashboardPanels: (panels: PanelType[]) => void
  setPluginView: (v: 'list' | 'grid') => void
  setDevMode: (v: boolean) => void
  setLastReload: (d: Date) => void
  setPreviewUser: (user: { discord_id: string; username: string; role: string; assigned_bot: { id: number; name: string } | null }) => void
  clearPreview: () => void
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      theme: 'dark',
      fontSize: 'normal',
      sidebarCollapsed: false,
      sidebarWidth: 224,
      dashboardPanels: ['servers', 'approvals', 'errors'],
      pluginView: 'list',
      devMode: false,
      lastReload: null as Date | null,
      previewUser: null,
      setTheme: (theme) => set({ theme }),
      setFontSize: (fontSize) => set({ fontSize }),
      setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
      setSidebarWidth: (sidebarWidth) => set({ sidebarWidth }),
      setDashboardPanels: (dashboardPanels) => set({ dashboardPanels }),
      setPluginView: (pluginView) => set({ pluginView }),
      setDevMode: (devMode) => set({ devMode }),
      setLastReload: (lastReload: Date) => set({ lastReload }),
      setPreviewUser: (user) => set({ previewUser: user }),
      clearPreview: () => set({ previewUser: null }),
    }),
    {
      name: 'infra-panel-ui',
      partialize: (state: UIState) => {
        const { lastReload, setLastReload, previewUser, setPreviewUser, clearPreview, ...persistedState } = state
        return persistedState
      }
    }
  )
)
