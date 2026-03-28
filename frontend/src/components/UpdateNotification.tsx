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
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-3 px-4 py-3 bg-blue-600 text-white rounded-xl shadow-2xl text-sm">
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
