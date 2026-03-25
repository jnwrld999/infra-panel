import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { useUIStore } from './store/uiStore'

function applyUIPrefs() {
  const { theme, fontSize } = useUIStore.getState()
  document.documentElement.setAttribute('data-theme', theme)
  document.documentElement.setAttribute('data-size', fontSize)
}

// Apply immediately (before render, to avoid flash)
applyUIPrefs()

// Subscribe to future changes
useUIStore.subscribe(() => applyUIPrefs())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
