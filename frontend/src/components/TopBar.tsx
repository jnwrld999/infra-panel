import { useEffect, useState, useRef } from 'react'
import { RefreshCw, Clock, AlertTriangle, Loader, RotateCcw, Download, ArrowUpCircle, ChevronDown } from 'lucide-react'
import client from '@/api/client'
import { useUIStore } from '@/store/uiStore'

interface AppInfo { version: string; build_date: string; latest_version?: string }
interface LogEntry { id: number }

const GH_CACHE_KEY = 'infra-panel-gh-latest'
const GH_CACHE_TTL = 10 * 60 * 1000 // 10 minutes

async function fetchLatestGitHubVersion(): Promise<string | null> {
  try {
    const cached = localStorage.getItem(GH_CACHE_KEY)
    if (cached) {
      const { version, ts } = JSON.parse(cached)
      if (Date.now() - ts < GH_CACHE_TTL) return version
    }
    const res = await fetch('https://api.github.com/repos/jnwrld999/infra-panel/releases/latest')
    if (!res.ok) return null
    const data = await res.json()
    const version = (data.tag_name as string).replace(/^v/, '')
    localStorage.setItem(GH_CACHE_KEY, JSON.stringify({ version, ts: Date.now() }))
    return version
  } catch {
    return null
  }
}

function isNewerVersion(latest: string, current: string): boolean {
  const toNum = (v: string) => v.split('.').map(Number)
  const [lMaj, lMin, lPat] = toNum(latest)
  const [cMaj, cMin, cPat] = toNum(current)
  if (lMaj !== cMaj) return lMaj > cMaj
  if (lMin !== cMin) return lMin > cMin
  return lPat > cPat
}

export function TopBar() {
  const [info, setInfo] = useState<AppInfo | null>(null)
  const [latestVersion, setLatestVersion] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)
  const [errorCount, setErrorCount] = useState(0)
  const [downloadOpen, setDownloadOpen] = useState(false)
  const downloadRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!downloadOpen) return
    const handler = (e: MouseEvent) => {
      if (downloadRef.current && !downloadRef.current.contains(e.target as Node)) {
        setDownloadOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [downloadOpen])
  const lastReload = useUIStore((s) => s.lastReload)
  const previewUser = useUIStore((s) => s.previewUser)
  const clearPreview = useUIStore((s) => s.clearPreview)

  useEffect(() => {
    client.get<AppInfo>('/info').then((r) => setInfo(r.data)).catch(() => {})
    client.get<LogEntry[]>('/logs/?level=ERROR&days=1&limit=50').then((r) => {
      setErrorCount(r.data.length)
    }).catch(() => {})
    fetchLatestGitHubVersion().then((v) => { if (v) setLatestVersion(v) })
  }, [])

  const checkForUpdates = () => {
    setChecking(true)
    localStorage.removeItem(GH_CACHE_KEY)
    fetchLatestGitHubVersion()
      .then((v) => { if (v) setLatestVersion(v) })
      .finally(() => setChecking(false))
  }

  const updateAvailable = !!(info && latestVersion && isNewerVersion(latestVersion, info.version))

  return (
    <>
      {/* Preview banner */}
      {previewUser && (
        <div className="bg-primary/20 border-b border-primary/30 px-4 py-1.5 flex items-center justify-between text-xs">
          <span className="text-primary font-medium">
            Vorschau als <strong>{previewUser.username}</strong> ({previewUser.role})
          </span>
          <button
            onClick={clearPreview}
            className="px-2 py-0.5 bg-primary text-primary-foreground rounded text-xs hover:opacity-90"
          >
            Beenden
          </button>
        </div>
      )}

      {/* Main TopBar */}
      <div className="relative flex items-center gap-4 px-4 py-2 bg-card border-b border-border flex-wrap">
        {/* Version */}
        {info && (
          <div className="flex items-center gap-1.5 text-xs">
            {updateAvailable ? (
              <a
                href="https://github.com/jnwrld999/infra-panel/releases/latest"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 font-medium hover:bg-blue-500/25 transition-colors"
                title={`v${latestVersion} herunterladen`}
              >
                <ArrowUpCircle size={11} />
                v{latestVersion} verfügbar
              </a>
            ) : (
              <span className="text-muted-foreground font-mono">v{info.version}</span>
            )}
            <button
              onClick={checkForUpdates}
              disabled={checking}
              title="Auf Updates prüfen"
              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
            >
              {checking ? <Loader size={11} className="animate-spin" /> : <RefreshCw size={11} />}
            </button>
          </div>
        )}

        <div className="w-px h-3 bg-border flex-shrink-0" />

        {/* Errors */}
        <div className={`flex items-center gap-1.5 text-xs ${errorCount > 0 ? 'text-red-400' : 'text-muted-foreground'}`}>
          <AlertTriangle size={12} />
          <span>{errorCount} Fehler (24h)</span>
        </div>

        {/* Centered Reload display */}
        {lastReload && (
          <div className="absolute left-1/2 -translate-x-1/2">
            <span className="text-xs text-muted-foreground">
              Reload: {lastReload.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        )}

        <div className="ml-auto flex items-center gap-3">
          {!window.infraPanel && (
            <div className="relative" ref={downloadRef}>
              <button
                onClick={() => setDownloadOpen((o) => !o)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 transition-colors"
              >
                <Download size={12} />
                Desktop App
                <ChevronDown size={10} className={`transition-transform ${downloadOpen ? 'rotate-180' : ''}`} />
              </button>
              {downloadOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden">
                  <div className="px-3 py-2 border-b border-border bg-muted/30">
                    <p className="text-xs font-semibold text-foreground">Desktop App herunterladen</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Installer-Skript wird generiert</p>
                  </div>
                  <div className="p-1.5 space-y-0.5">
                    {([
                      { label: 'Windows', sub: '.bat Installer', icon: '🪟', platform: 'windows' },
                      { label: 'Linux', sub: '.sh Installer', icon: '🐧', platform: 'linux' },
                    ] as { label: string; sub: string; icon: string; platform: 'windows' | 'linux' }[]).map(({ label, sub, icon, platform }) => (
                      <button
                        key={platform}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted transition-colors text-left"
                        onClick={() => {
                          setDownloadOpen(false)
                          if (platform === 'windows') {
                            const ps = [
                              "$ErrorActionPreference = 'Stop'",
                              "try {",
                              "  $releases = Invoke-RestMethod -Headers @{'User-Agent'='InfraPanel-Installer'} 'https://api.github.com/repos/jnwrld999/infra-panel/releases'",
                              "  $asset = $null",
                              "  $relTag = ''",
                              "  foreach ($r in $releases) {",
                              "    $a = $r.assets | Where-Object { $_.name -match '(?i)(win|windows|\\.exe|\\.zip)' } | Sort-Object { $_.name -notlike '*win*' } | Select-Object -First 1",
                              "    if ($a) { $asset = $a; $relTag = $r.tag_name; break }",
                              "  }",
                              "  if (!$asset) { throw 'Kein Windows-Download gefunden. Bitte manuell laden: https://github.com/jnwrld999/infra-panel/releases/latest' }",
                              "  $zip = Join-Path $env:TEMP 'InfraPanel-install.zip'",
                              "  $dir = Join-Path $env:TEMP 'InfraPanel-install'",
                              "  Write-Host ('==> Version: ' + $relTag)",
                              "  Write-Host ('==> Download: ' + $asset.name)",
                              "  Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $zip -UseBasicParsing",
                              "  if (Test-Path $dir) { Remove-Item $dir -Recurse -Force }",
                              "  Expand-Archive -Path $zip -DestinationPath $dir -Force",
                              "  $exe = Get-ChildItem $dir -Filter '*.exe' -Recurse | Sort-Object Length -Descending | Select-Object -First 1",
                              "  if (!$exe) { throw 'Keine .exe im Archiv. Bitte manuell installieren.' }",
                              "  Write-Host ('==> Starte: ' + $exe.Name)",
                              "  Start-Process $exe.FullName",
                              "} catch {",
                              "  Write-Host ''",
                              "  Write-Host ('FEHLER: ' + $_.Exception.Message) -ForegroundColor Red",
                              "  Write-Host ''",
                              "  Write-Host 'Direktlink: https://github.com/jnwrld999/infra-panel/releases/latest' -ForegroundColor Cyan",
                              "  Read-Host 'Enter druecken zum Schliessen'",
                              "  exit 1",
                              "}",
                            ].join('\n')
                            const bat = [
                              '@echo off',
                              'title InfraPanel Installer',
                              'echo.',
                              'echo  ╔══════════════════════════════╗',
                              'echo  ║     InfraPanel Installer     ║',
                              'echo  ╚══════════════════════════════╝',
                              'echo.',
                              'echo  Suche neueste Version auf GitHub...',
                              'echo.',
                              'powershell -NoProfile -ExecutionPolicy Bypass -Command "' + ps.replace(/"/g, '\\"') + '"',
                              'if %errorlevel% neq 0 (',
                              '    echo.',
                              '    echo  Fehler beim automatischen Download.',
                              '    echo  Bitte manuell herunterladen:',
                              '    echo  https://github.com/jnwrld999/infra-panel/releases/latest',
                              '    echo.',
                              '    pause',
                              '    exit /b 1',
                              ')',
                            ].join('\r\n')
                            const blob = new Blob([bat], { type: 'application/octet-stream' })
                            const blobUrl = URL.createObjectURL(blob)
                            const a = document.createElement('a')
                            a.href = blobUrl
                            a.download = 'install-infrapanel.bat'
                            a.click()
                            URL.revokeObjectURL(blobUrl)
                          } else {
                            const sh = [
                              '#!/bin/bash',
                              'set -e',
                              'echo ""',
                              'echo " ╔══════════════════════════════╗"',
                              'echo " ║     InfraPanel Installer     ║"',
                              'echo " ╚══════════════════════════════╝"',
                              'echo ""',
                              'echo " Suche neueste Version auf GitHub..."',
                              'API=$(curl -fsSL -H "User-Agent: InfraPanel-Installer" https://api.github.com/repos/jnwrld999/infra-panel/releases/latest)',
                              'URL=$(echo "$API" | python3 -c "',
                              'import sys, json',
                              'data = json.load(sys.stdin)',
                              'assets = [a for a in data.get(\"assets\", []) if any(x in a[\"name\"].lower() for x in [\"linux\", \"appimage\", \".sh\"])]',
                              'print(assets[0][\"browser_download_url\"] if assets else \"\")',
                              '" 2>/dev/null || echo "")',
                              'if [ -z "$URL" ]; then',
                              '  echo ""',
                              '  echo " FEHLER: Kein Linux-Download gefunden."',
                              '  echo " Bitte manuell herunterladen:"',
                              '  echo " https://github.com/jnwrld999/infra-panel/releases/latest"',
                              '  exit 1',
                              'fi',
                              'NAME=$(basename "$URL")',
                              'DEST="$HOME/Downloads/$NAME"',
                              'echo " ==> Download: $NAME"',
                              'curl -L --progress-bar -o "$DEST" "$URL"',
                              'chmod +x "$DEST"',
                              'echo ""',
                              'echo " ==> Heruntergeladen: $DEST"',
                              'echo " ==> Starte InfraPanel..."',
                              '"$DEST" --no-sandbox &',
                              'echo ""',
                              'echo " Fertig!"',
                            ].join('\n')
                            const blob = new Blob([sh], { type: 'application/octet-stream' })
                            const blobUrl = URL.createObjectURL(blob)
                            const a = document.createElement('a')
                            a.href = blobUrl
                            a.download = 'install-infrapanel.sh'
                            a.click()
                            URL.revokeObjectURL(blobUrl)
                          }
                        }}
                      >
                        <span className="text-base">{icon}</span>
                        <div>
                          <p className="text-xs font-medium text-foreground">{label}</p>
                          <p className="text-xs text-muted-foreground">{sub}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                  <div className="px-3 py-2 border-t border-border bg-muted/30">
                    <a
                      href="https://github.com/jnwrld999/infra-panel/releases/latest"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline"
                    >
                      → Alle Releases auf GitHub
                    </a>
                  </div>
                </div>
              )}
            </div>
          )}
          <button
            onClick={() => {
              if (window.infraPanel?.restart) {
                window.infraPanel.restart()
              } else {
                window.location.reload()
              }
            }}
            title="App neu starten"
            className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <RotateCcw size={12} />
            Neu starten
          </button>
        </div>
      </div>
    </>
  )
}
