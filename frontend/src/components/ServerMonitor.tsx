import { useEffect, useRef, useState } from 'react'
import client from '@/api/client'

interface Stats {
  cpu: number
  ram_used: number
  ram_total: number
  disk_used: number
  disk_total: number
}

const HISTORY = 60
const CPU_COLOR = '#3b82f6'   // blue-500
const RAM_COLOR = '#f59e0b'   // amber-500
const CHART_H = 90            // chart height in px

function LineChart({ data, color, label, value }: {
  data: number[]
  color: string
  label: string
  value: string
}) {
  const W = 200
  const H = CHART_H
  const pad = 1

  const pts = data.map((v, i) => {
    const x = pad + (i / (HISTORY - 1)) * (W - pad * 2)
    const y = H - pad - Math.max(0, Math.min(100, v)) / 100 * (H - pad * 2)
    return [x, y] as [number, number]
  })

  const linePath = pts.length > 1
    ? 'M ' + pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' L ')
    : ''

  const fillPath = pts.length > 1
    ? `M ${pts[0][0].toFixed(1)},${(H - pad).toFixed(1)} ` +
      'L ' + pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' L ') +
      ` L ${pts[pts.length - 1][0].toFixed(1)},${(H - pad).toFixed(1)} Z`
    : ''

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-xs font-mono font-medium" style={{ color }}>{value}</span>
      </div>
      <div className="rounded-md overflow-hidden bg-muted/20 border border-border/40" style={{ height: CHART_H }}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="w-full h-full"
        >
          <defs>
            <linearGradient id={`grad-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.25" />
              <stop offset="100%" stopColor={color} stopOpacity="0.02" />
            </linearGradient>
          </defs>
          {/* horizontal grid lines at 25 / 50 / 75 % */}
          {[25, 50, 75].map((pct) => {
            const y = H - pad - (pct / 100) * (H - pad * 2)
            return (
              <line
                key={pct}
                x1={pad} x2={W - pad}
                y1={y.toFixed(1)} y2={y.toFixed(1)}
                stroke="currentColor" strokeOpacity="0.07" strokeWidth="0.5"
              />
            )
          })}
          {fillPath && (
            <path d={fillPath} fill={`url(#grad-${color.replace('#', '')})`} />
          )}
          {linePath && (
            <path
              d={linePath}
              fill="none"
              stroke={color}
              strokeWidth="1.5"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}
        </svg>
      </div>
    </div>
  )
}

function DiskBar({ used, total }: { used: number; total: number }) {
  const pct = total > 0 ? Math.min(100, (used / total) * 100) : 0
  const fmt = (b: number) =>
    b >= 1e12 ? (b / 1e12).toFixed(1) + ' TB'
    : b >= 1e9  ? (b / 1e9).toFixed(1) + ' GB'
    : (b / 1e6).toFixed(0) + ' MB'

  const barColor =
    pct > 90 ? '#ef4444'
    : pct > 75 ? '#f97316'
    : '#22c55e'

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs text-muted-foreground">Speicher (/)</span>
        <span className="text-xs font-mono font-medium" style={{ color: barColor }}>
          {fmt(used)} / {fmt(total)} &nbsp;({pct.toFixed(0)}%)
        </span>
      </div>
      <div className="h-2.5 w-full rounded-full overflow-hidden bg-muted/40">
        <div
          className="h-full rounded-full transition-[width] duration-700 ease-out"
          style={{ width: `${pct}%`, backgroundColor: barColor }}
        />
      </div>
    </div>
  )
}

export function ServerMonitor({ serverId, serverName }: { serverId: number; serverName: string }) {
  const [cpuHistory, setCpuHistory] = useState<number[]>([])
  const [ramHistory, setRamHistory] = useState<number[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [error, setError] = useState(false)
  const inFlight = useRef(false)

  useEffect(() => {
    let alive = true

    const poll = async () => {
      if (inFlight.current || !alive) return
      inFlight.current = true
      try {
        const { data } = await client.get<Stats>(`/servers/${serverId}/stats`)
        if (!alive) return
        const ramPct = data.ram_total > 0 ? (data.ram_used / data.ram_total) * 100 : 0
        setStats(data)
        setError(false)
        setCpuHistory((h) => [...h.slice(-(HISTORY - 1)), data.cpu])
        setRamHistory((h) => [...h.slice(-(HISTORY - 1)), ramPct])
      } catch {
        if (alive) setError(true)
      } finally {
        inFlight.current = false
      }
    }

    poll()
    const id = setInterval(poll, 1000)
    return () => { alive = false; clearInterval(id) }
  }, [serverId])

  const ramPct = stats && stats.ram_total > 0
    ? (stats.ram_used / stats.ram_total) * 100
    : 0

  const formatMem = (b: number) =>
    b >= 1e9 ? (b / 1e9).toFixed(1) + ' GB' : (b / 1e6).toFixed(0) + ' MB'

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${error ? 'bg-red-500' : 'bg-green-500 animate-pulse'}`} />
          <span className="font-semibold text-sm text-foreground truncate">{serverName}</span>
        </div>
        {error && <span className="text-xs text-red-400 shrink-0">Nicht erreichbar</span>}
      </div>

      <LineChart
        data={cpuHistory}
        color={CPU_COLOR}
        label="CPU"
        value={stats ? `${stats.cpu.toFixed(1)}%` : '—'}
      />

      <LineChart
        data={ramHistory}
        color={RAM_COLOR}
        label={`RAM${stats ? ` · ${formatMem(stats.ram_used)} / ${formatMem(stats.ram_total)}` : ''}`}
        value={stats ? `${ramPct.toFixed(1)}%` : '—'}
      />

      {stats
        ? <DiskBar used={stats.disk_used} total={stats.disk_total} />
        : (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-muted-foreground">Speicher (/)</span>
              <span className="text-xs text-muted-foreground">—</span>
            </div>
            <div className="h-2.5 w-full rounded-full bg-muted/40" />
          </div>
        )
      }
    </div>
  )
}
