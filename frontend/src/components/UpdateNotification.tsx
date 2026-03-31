import { useState, useEffect } from 'react'
import { ArrowUpCircle, X, Download, CheckCircle } from 'lucide-react'

function isNewerVersion(latest: string, current: string): boolean {
  const toNum = (v: string) => v.split('.').map(Number)
  const [lMaj, lMin, lPat] = toNum(latest)
  const [cMaj, cMin, cPat] = toNum(current)
  if (lMaj !== cMaj) return lMaj > cMaj
  if (lMin !== cMin) return lMin > cMin
  return lPat > cPat
}

function detectPlatform(): 'windows' | 'linux' {
  const platform = (window as any).infraPanel?.platform ?? navigator.userAgent
  if (typeof platform === 'string' && (platform.includes('win32') || platform.toLowerCase().includes('windows'))) return 'windows'
  return 'linux'
}

async function findAssetUrl(): Promise<{ url: string; name: string } | null> {
  const platform = detectPlatform()
  const keyword = platform === 'windows' ? ['win', 'windows'] : ['linux', 'appimage']
  const res = await fetch('https://api.github.com/repos/jnwrld999/infra-panel/releases', {
    headers: { 'User-Agent': 'InfraPanel-Updater' },
  })
  if (!res.ok) return null
  const releases: { assets: { name: string; browser_download_url: string }[] }[] = await res.json()
  for (const release of releases) {
    const asset = release.assets.find((a) => keyword.some((k) => a.name.toLowerCase().includes(k)))
    if (asset) return { url: asset.browser_download_url, name: asset.name }
  }
  return null
}

interface UpdateNotificationProps {
  latestVersion: string | null
  currentVersion: string | null
}

export function UpdateNotification({ latestVersion, currentVersion }: UpdateNotificationProps) {
  const [visible, setVisible] = useState(false)
  const [state, setState] = useState<'idle' | 'preparing' | 'downloading' | 'done' | 'error'>('idle')
  const [progress, setProgress] = useState(0)
  const [received, setReceived] = useState(0)
  const [total, setTotal] = useState(0)

  useEffect(() => {
    if (!latestVersion || !currentVersion) return
    if (!isNewerVersion(latestVersion, currentVersion)) return
    setVisible(true)
  }, [latestVersion, currentVersion])

  const handleDownload = async () => {
    setState('preparing')
    setProgress(0)
    setReceived(0)
    setTotal(0)

    try {
      const asset = await findAssetUrl()
      if (!asset) throw new Error('Kein Asset gefunden')

      setState('downloading')
      const res = await fetch(asset.url)
      if (!res.ok) throw new Error('Download fehlgeschlagen')

      const contentLength = res.headers.get('content-length')
      const totalBytes = contentLength ? parseInt(contentLength) : 0
      setTotal(totalBytes)

      const reader = res.body!.getReader()
      const chunks: Uint8Array<ArrayBuffer>[] = []
      let receivedBytes = 0

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        chunks.push(value)
        receivedBytes += value.length
        setReceived(receivedBytes)
        if (totalBytes) setProgress(Math.round((receivedBytes / totalBytes) * 100))
      }

      const blob = new Blob(chunks)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = asset.name
      a.click()
      URL.revokeObjectURL(url)

      setState('done')
      setTimeout(() => setVisible(false), 3000)
    } catch {
      setState('error')
    }
  }

  if (!visible || !latestVersion) return null

  const formatBytes = (b: number) => b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${(b / 1024).toFixed(0)} KB`

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 px-4 py-3 bg-blue-600 text-white rounded-xl shadow-2xl text-sm min-w-72">
      <div className="flex items-center gap-3">
        {state === 'done'
          ? <CheckCircle size={16} className="flex-shrink-0" />
          : <ArrowUpCircle size={16} className="flex-shrink-0" />
        }
        <span className="flex-1">
          {state === 'done'
            ? <strong>Download abgeschlossen!</strong>
            : <><strong>InfraPanel v{latestVersion}</strong> ist verfügbar</>
          }
        </span>
        {state === 'idle' || state === 'error' ? (
          <button
            onClick={handleDownload}
            className="flex items-center gap-1 px-2 py-0.5 bg-white/20 hover:bg-white/30 rounded-md font-medium transition-colors"
          >
            <Download size={12} />
            {state === 'error' ? 'Erneut' : 'Herunterladen'}
          </button>
        ) : null}
        {state !== 'downloading' && state !== 'preparing' && (
          <button
            onClick={() => setVisible(false)}
            className="p-0.5 hover:bg-white/20 rounded-md transition-colors"
            title="Schließen"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {(state === 'preparing' || state === 'downloading') && (
        <div className="flex flex-col gap-1">
          <div className="w-full h-1.5 bg-white/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-white rounded-full transition-all duration-200"
              style={{ width: state === 'preparing' ? '5%' : `${progress}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-white/70">
            <span>{state === 'preparing' ? 'Suche Download…' : `${formatBytes(received)}${total ? ` / ${formatBytes(total)}` : ''}`}</span>
            <span>{state === 'downloading' && total ? `${progress}%` : ''}</span>
          </div>
        </div>
      )}

      {state === 'error' && (
        <p className="text-xs text-white/80">Download fehlgeschlagen. Bitte erneut versuchen.</p>
      )}
    </div>
  )
}
