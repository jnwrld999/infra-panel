import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Theme = 'dark' | 'light' | 'monokai' | 'dracula' | 'nord' | 'solarized' | 'catppuccin' | 'onedark'
type FontSize = 'small' | 'normal' | 'large'

export type PanelType = 'servers' | 'approvals' | 'errors' | 'sync' | 'users'

interface UIState {
  theme: Theme
  fontSize: FontSize
  sidebarCollapsed: boolean
  sidebarWidth: number        // pixels, default 224 (w-56)
  dashboardPanels: PanelType[]
  pluginView: 'list' | 'grid'
  stayLoggedIn: boolean
  devMode: boolean
  setTheme: (t: Theme) => void
  setFontSize: (s: FontSize) => void
  setSidebarCollapsed: (v: boolean) => void
  setSidebarWidth: (w: number) => void
  setDashboardPanels: (panels: PanelType[]) => void
  setPluginView: (v: 'list' | 'grid') => void
  setStayLoggedIn: (v: boolean) => void
  setDevMode: (v: boolean) => void
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
      stayLoggedIn: false,
      devMode: false,
      setTheme: (theme) => set({ theme }),
      setFontSize: (fontSize) => set({ fontSize }),
      setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
      setSidebarWidth: (sidebarWidth) => set({ sidebarWidth }),
      setDashboardPanels: (dashboardPanels) => set({ dashboardPanels }),
      setPluginView: (pluginView) => set({ pluginView }),
      setStayLoggedIn: (stayLoggedIn) => set({ stayLoggedIn }),
      setDevMode: (devMode) => set({ devMode }),
    }),
    { name: 'infra-panel-ui' }
  )
)
