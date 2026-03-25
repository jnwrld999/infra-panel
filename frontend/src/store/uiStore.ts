import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type Theme = 'dark' | 'light' | 'monokai'
type FontSize = 'small' | 'normal' | 'large'

interface UIState {
  theme: Theme
  fontSize: FontSize
  sidebarCollapsed: boolean
  sidebarWidth: number        // pixels, default 224 (w-56)
  setTheme: (t: Theme) => void
  setFontSize: (s: FontSize) => void
  setSidebarCollapsed: (v: boolean) => void
  setSidebarWidth: (w: number) => void
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      theme: 'dark',
      fontSize: 'normal',
      sidebarCollapsed: false,
      sidebarWidth: 224,
      setTheme: (theme) => set({ theme }),
      setFontSize: (fontSize) => set({ fontSize }),
      setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
      setSidebarWidth: (sidebarWidth) => set({ sidebarWidth }),
    }),
    { name: 'infra-panel-ui' }
  )
)
