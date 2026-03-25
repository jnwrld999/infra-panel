import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type Theme = 'dark' | 'light' | 'monokai'
type FontSize = 'small' | 'normal' | 'large'

export type PanelType = 'servers' | 'approvals' | 'errors' | 'sync' | 'services'

interface UIState {
  theme: Theme
  fontSize: FontSize
  sidebarCollapsed: boolean
  sidebarWidth: number        // pixels, default 224 (w-56)
  dashboardPanels: PanelType[]
  setTheme: (t: Theme) => void
  setFontSize: (s: FontSize) => void
  setSidebarCollapsed: (v: boolean) => void
  setSidebarWidth: (w: number) => void
  setDashboardPanels: (panels: PanelType[]) => void
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      theme: 'dark',
      fontSize: 'normal',
      sidebarCollapsed: false,
      sidebarWidth: 224,
      dashboardPanels: ['servers', 'approvals', 'errors'],
      setTheme: (theme) => set({ theme }),
      setFontSize: (fontSize) => set({ fontSize }),
      setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
      setSidebarWidth: (sidebarWidth) => set({ sidebarWidth }),
      setDashboardPanels: (dashboardPanels) => set({ dashboardPanels }),
    }),
    { name: 'infra-panel-ui' }
  )
)
