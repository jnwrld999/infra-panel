import { useEffect, useRef, useState } from 'react'
import { Plus, Trash2, Send, Eye, EyeOff, ChevronDown, Save, FolderOpen, X, Info } from 'lucide-react'
import client from '@/api/client'
import { useAuthStore } from '@/store/authStore'
import { useUIStore } from '@/store/uiStore'

// ---- Types ----
interface BotOption { id: number; name: string; restricted: boolean }
interface BotProfile { username: string; avatar_url: string | null }

interface EmbedField { name: string; value: string; inline: boolean }
interface EmbedButton { label: string; style: 1 | 2 | 3 | 4 | 5; custom_id: string; url: string; emoji: string; disabled: boolean }

interface EmbedData {
  title: string
  url: string
  description: string
  color: string
  authorName: string
  authorIconUrl: string
  authorUrl: string
  footerText: string
  footerIconUrl: string
  imageUrl: string
  thumbnailUrl: string
  timestamp: boolean
  fields: EmbedField[]
}

interface SavedPreset {
  id: number
  name: string
  bot_id: number | null
  channel_id: string | null
  data: { embed: EmbedData; buttons: EmbedButton[]; content: string }
  updated_at: string | null
}

const DEFAULT_EMBED: EmbedData = {
  title: '', url: '', description: '', color: '#5865f2',
  authorName: '', authorIconUrl: '', authorUrl: '',
  footerText: '', footerIconUrl: '', imageUrl: '', thumbnailUrl: '',
  timestamp: false, fields: [],
}

const DEFAULT_BUTTON: EmbedButton = { label: '', style: 1, custom_id: '', url: '', emoji: '', disabled: false }

const BUTTON_STYLES: { value: 1 | 2 | 3 | 4 | 5; label: string; cls: string }[] = [
  { value: 1, label: 'Primary',   cls: 'bg-[#5865f2] text-white' },
  { value: 2, label: 'Secondary', cls: 'bg-[#4e5058] text-white' },
  { value: 3, label: 'Success',   cls: 'bg-[#248046] text-white' },
  { value: 4, label: 'Danger',    cls: 'bg-[#da373c] text-white' },
  { value: 5, label: 'Link',      cls: 'bg-[#4e5058] text-white' },
]

function hexToInt(hex: string): number {
  return parseInt(hex.replace('#', ''), 16)
}

// Render Discord mention syntax with proper styling
function renderContent(text: string) {
  const parts = text.split(/(<@&\d+>|<@\d+>|<#\d+>|@everyone|@here)/g)
  return parts.map((part, i) => {
    if (part === '@everyone' || part === '@here')
      return <span key={i} className="rounded px-0.5 font-medium" style={{ background: 'rgba(88,101,242,0.3)', color: '#c9cdfb' }}>{part}</span>
    if (/^<@&\d+>$/.test(part))
      return <span key={i} className="rounded px-0.5 font-medium cursor-pointer" style={{ background: 'rgba(88,101,242,0.3)', color: '#c9cdfb' }}>@Role</span>
    if (/^<@\d+>$/.test(part))
      return <span key={i} className="rounded px-0.5 font-medium cursor-pointer" style={{ background: 'rgba(88,101,242,0.3)', color: '#c9cdfb' }}>@User</span>
    if (/^<#\d+>$/.test(part)) {
      const id = part.slice(2, -1)
      return <span key={i} className="font-medium cursor-pointer" style={{ color: '#00b0f4' }}>#{id}</span>
    }
    return <span key={i}>{part}</span>
  })
}

// ---- Bot Avatar (handles load errors gracefully) ----
function BotAvatar({ profile }: { profile: BotProfile | null }) {
  const [failed, setFailed] = useState(false)
  const letter = (profile?.username ?? 'B').slice(0, 1).toUpperCase()
  if (profile?.avatar_url && !failed) {
    return (
      <img
        src={profile.avatar_url}
        className="w-9 h-9 rounded-full flex-shrink-0 mt-0.5 object-cover"
        alt=""
        onError={() => setFailed(true)}
      />
    )
  }
  return (
    <div className="w-9 h-9 rounded-full bg-[#5865f2] flex items-center justify-center flex-shrink-0 mt-0.5">
      <span className="text-white text-xs font-bold">{letter}</span>
    </div>
  )
}

// ---- Discord Preview ----
function DiscordPreview({ embed, buttons, content, botProfile }: {
  embed: EmbedData
  buttons: EmbedButton[]
  content: string
  botProfile: BotProfile | null
}) {
  const colorBar = embed.color || '#5865f2'
  const hasEmbed = embed.title || embed.description || embed.authorName || embed.footerText ||
    embed.imageUrl || embed.thumbnailUrl || embed.fields.length > 0
  const hasButtons = buttons.filter(b => b.label).length > 0
  const hasContent = !!content.trim()

  if (!hasEmbed && !hasButtons && !hasContent) {
    return (
      <div className="flex items-center justify-center h-48 text-[#949ba4] text-sm bg-[#313338] rounded-lg">
        Vorschau erscheint hier
      </div>
    )
  }

  const now = new Date()
  const timeStr = `Heute um ${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}`

  return (
    <div className="bg-[#313338] rounded-lg p-4 font-sans space-y-1">
      {/* Bot header */}
      <div className="flex items-start gap-2.5">
        <BotAvatar profile={botProfile} />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-1.5 mb-0.5">
            <span className="text-sm font-semibold text-[#dbdee1]">{botProfile?.username ?? 'Bot'}</span>
            <span className="text-[9px] px-1 py-0.5 rounded bg-[#5865f2] text-white font-medium uppercase">BOT</span>
            <span className="text-[11px] text-[#949ba4]">{timeStr}</span>
          </div>
          {/* Content */}
          {hasContent && (
            <div className="text-sm text-[#dbdee1] whitespace-pre-wrap leading-relaxed mb-1">
              {renderContent(content)}
            </div>
          )}
          {/* Embed */}
          {hasEmbed && (
            <div
              className="rounded overflow-hidden max-w-[432px]"
              style={{ borderLeft: `4px solid ${colorBar}`, background: '#2b2d31' }}
            >
              <div className="p-3">
                {embed.authorName && (
                  <div className="flex items-center gap-1.5 mb-2">
                    {embed.authorIconUrl && (
                      <img src={embed.authorIconUrl} className="w-5 h-5 rounded-full" alt="" onError={(e) => (e.currentTarget.style.display = 'none')} />
                    )}
                    <span className="text-xs font-semibold text-[#dbdee1]">{embed.authorName}</span>
                  </div>
                )}
                <div className="flex gap-3">
                  <div className="flex-1 min-w-0">
                    {embed.title && (
                      <div className={`font-semibold text-sm mb-1 ${embed.url ? 'text-[#00b0f4] cursor-pointer hover:underline' : 'text-[#dbdee1]'}`}>
                        {embed.title}
                      </div>
                    )}
                    {embed.description && (
                      <div className="text-[#dbdee1] text-sm whitespace-pre-wrap leading-relaxed">
                        {renderContent(embed.description)}
                      </div>
                    )}
                  </div>
                  {embed.thumbnailUrl && (
                    <img src={embed.thumbnailUrl} className="w-16 h-16 rounded object-cover flex-shrink-0" alt="" onError={(e) => (e.currentTarget.style.display = 'none')} />
                  )}
                </div>
                {embed.fields.length > 0 && (
                  <div className="grid gap-2 mt-2" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                    {embed.fields.map((f, i) => (
                      <div key={i} style={{ gridColumn: f.inline ? 'span 1' : 'span 3' }}>
                        {f.name && <div className="text-xs font-semibold text-[#dbdee1] mb-0.5">{f.name}</div>}
                        {f.value && <div className="text-xs text-[#dbdee1] whitespace-pre-wrap">{f.value}</div>}
                      </div>
                    ))}
                  </div>
                )}
                {embed.imageUrl && (
                  <img src={embed.imageUrl} className="mt-3 rounded max-w-full" alt="" onError={(e) => (e.currentTarget.style.display = 'none')} />
                )}
                {(embed.footerText || embed.timestamp) && (
                  <div className="flex items-center gap-1.5 mt-3">
                    {embed.footerIconUrl && (
                      <img src={embed.footerIconUrl} className="w-4 h-4 rounded-full" alt="" onError={(e) => (e.currentTarget.style.display = 'none')} />
                    )}
                    <span className="text-[10px] text-[#949ba4]">
                      {embed.footerText}
                      {embed.footerText && embed.timestamp && ' • '}
                      {embed.timestamp && new Date().toLocaleDateString('de-DE')}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
          {/* Buttons */}
          {hasButtons && (
            <div className="flex flex-wrap gap-2 mt-2">
              {buttons.filter(b => b.label).map((btn, i) => {
                const s = BUTTON_STYLES.find(s => s.value === btn.style) || BUTTON_STYLES[0]
                return (
                  <button key={i} disabled className={`px-3 py-1.5 rounded text-xs font-medium ${s.cls} ${btn.disabled ? 'opacity-50' : ''}`}>
                    {btn.emoji && <span className="mr-1">{btn.emoji}</span>}
                    {btn.label}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ---- Field editor ----
function FieldEditor({ field, onChange, onRemove }: { field: EmbedField; onChange: (f: EmbedField) => void; onRemove: () => void }) {
  return (
    <div className="border border-border rounded-lg p-3 space-y-2">
      <div className="flex gap-2">
        <input className="flex-1 bg-muted border border-border rounded px-2 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          placeholder="Field Name" value={field.name} onChange={e => onChange({ ...field, name: e.target.value })} />
        <button onClick={onRemove} className="p-1.5 text-muted-foreground hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"><Trash2 size={14} /></button>
      </div>
      <textarea className="w-full bg-muted border border-border rounded px-2 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
        placeholder="Field Value" rows={2} value={field.value} onChange={e => onChange({ ...field, value: e.target.value })} />
      <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
        <input type="checkbox" checked={field.inline} onChange={e => onChange({ ...field, inline: e.target.checked })} />
        Inline (nebeneinander mit anderen Inline-Fields)
      </label>
    </div>
  )
}

// ---- Tooltip ----
function Tooltip({ text }: { text: string }) {
  const [show, setShow] = useState(false)
  return (
    <span className="relative inline-flex items-center">
      <button
        className="text-muted-foreground hover:text-foreground transition-colors"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onClick={e => { e.preventDefault(); setShow(s => !s) }}
        type="button"
      >
        <Info size={13} />
      </button>
      {show && (
        <div className="absolute left-5 top-0 z-50 w-64 bg-card border border-border rounded-lg p-2.5 text-xs text-foreground shadow-lg leading-relaxed">
          {text}
        </div>
      )}
    </span>
  )
}

// ---- Button editor ----
function ButtonEditor({ btn, onChange, onRemove }: { btn: EmbedButton; onChange: (b: EmbedButton) => void; onRemove: () => void }) {
  return (
    <div className="border border-border rounded-lg p-3 space-y-2">
      <div className="flex gap-2">
        <input className="flex-1 bg-muted border border-border rounded px-2 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          placeholder="Label" value={btn.label} onChange={e => onChange({ ...btn, label: e.target.value })} />
        <input className="w-16 bg-muted border border-border rounded px-2 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          placeholder="Emoji" value={btn.emoji} onChange={e => onChange({ ...btn, emoji: e.target.value })} />
        <button onClick={onRemove} className="p-1.5 text-muted-foreground hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"><Trash2 size={14} /></button>
      </div>
      <div className="flex gap-2 items-center">
        <select
          className="flex-1 bg-muted border border-border rounded px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          value={btn.style}
          onChange={e => onChange({ ...btn, style: Number(e.target.value) as EmbedButton['style'] })}
        >
          {BUTTON_STYLES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        {btn.style === 5 ? (
          <input className="flex-1 bg-muted border border-border rounded px-2 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="URL" value={btn.url} onChange={e => onChange({ ...btn, url: e.target.value })} />
        ) : (
          <div className="flex-1 flex items-center gap-1">
            <input className="flex-1 min-w-0 bg-muted border border-border rounded px-2 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="Custom ID" value={btn.custom_id} onChange={e => onChange({ ...btn, custom_id: e.target.value })} />
            <Tooltip text="Die Custom ID ist ein eindeutiger Name für diesen Button (z.B. 'ticket_open'). Dein Bot-Code empfängt diese ID wenn jemand den Button klickt, damit er weiß welcher Button gedrückt wurde. Keine Leerzeichen, max. 100 Zeichen." />
          </div>
        )}
      </div>
      <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
        <input type="checkbox" checked={btn.disabled} onChange={e => onChange({ ...btn, disabled: e.target.checked })} />
        Deaktiviert
      </label>
    </div>
  )
}

// ---- Helpers ----
function FieldLabel({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div className="block text-xs font-medium text-muted-foreground mb-1">{label}</div>
      {children}
    </div>
  )
}

function Input({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      className="w-full bg-muted border border-border rounded px-2 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
      value={value} placeholder={placeholder} onChange={e => onChange(e.target.value)}
    />
  )
}

function Section({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button className="w-full flex items-center justify-between px-4 py-3 bg-card hover:bg-muted/50 transition-colors text-left" onClick={() => setOpen(!open)}>
        <span className="text-sm font-semibold text-foreground">{title}</span>
        <ChevronDown size={14} className={`text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="px-4 pb-4 pt-3 bg-card space-y-3">{children}</div>}
    </div>
  )
}

// ---- Saved Presets Panel ----
function PresetPanel({
  presets, onLoad, onDelete, onClose,
}: {
  presets: SavedPreset[]
  onLoad: (p: SavedPreset) => void
  onDelete: (id: number) => void
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-card border border-border rounded-xl w-full max-w-md mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="font-semibold text-foreground">Gespeicherte Embeds</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors"><X size={16} /></button>
        </div>
        <div className="p-4 max-h-96 overflow-y-auto space-y-2">
          {presets.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">Noch keine gespeicherten Embeds</p>}
          {presets.map(p => (
            <div key={p.id} className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{p.name}</p>
                <p className="text-xs text-muted-foreground">{p.updated_at ? new Date(p.updated_at).toLocaleDateString('de-DE') : ''}</p>
              </div>
              <div className="flex items-center gap-1 ml-2">
                <button onClick={() => onLoad(p)} className="px-2 py-1 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/80 transition-colors">Laden</button>
                <button onClick={() => onDelete(p.id)} className="p-1.5 text-muted-foreground hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"><Trash2 size={13} /></button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ---- Main page ----
export default function EmbedBuilder() {
  const { user } = useAuthStore()
  const previewUser = (useUIStore as any)((s: any) => s.previewUser) ?? null
  const effectiveUser = previewUser ?? user
  const [bots, setBots] = useState<BotOption[]>([])
  const [selectedBotId, setSelectedBotId] = useState<number | null>(null)
  const [botProfile, setBotProfile] = useState<BotProfile | null>(null)
  const [selectedChannelId, setSelectedChannelId] = useState<string>('')
  const [embed, setEmbed] = useState<EmbedData>(DEFAULT_EMBED)
  const [buttons, setButtons] = useState<EmbedButton[]>([])
  const [content, setContent] = useState('')
  const [showPreview, setShowPreview] = useState(true)
  const [sending, setSending] = useState(false)
  const [sentMessageId, setSentMessageId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  // Presets
  const [presets, setPresets] = useState<SavedPreset[]>([])
  const [showPresets, setShowPresets] = useState(false)
  const [saveModalOpen, setSaveModalOpen] = useState(false)
  const [saveName, setSaveName] = useState('')
  const [saving, setSaving] = useState(false)
  const [currentPresetId, setCurrentPresetId] = useState<number | null>(null)
  const saveNameRef = useRef<HTMLInputElement>(null)

  const presetsKey = effectiveUser?.discord_id ? `embed-presets-${effectiveUser.discord_id}` : null

  // Load bots
  useEffect(() => {
    client.get<BotOption[]>('/bots/').then(r => {
      const available = r.data.filter(b => !b.restricted)
      // bot_owner only sees their assigned bot
      const filtered = effectiveUser?.role === 'bot_owner' && effectiveUser.assigned_bot
        ? available.filter(b => b.id === (effectiveUser.assigned_bot as { id: number }).id)
        : available
      setBots(filtered)
      if (filtered.length === 1) setSelectedBotId(filtered[0].id)
    }).catch(() => {})
  }, [effectiveUser])

  // Load bot profile when bot changes
  useEffect(() => {
    if (!selectedBotId) { setBotProfile(null); return }
    setBotProfile(null)
    setSelectedChannelId('')
    client.get<BotProfile>(`/bots/${selectedBotId}/profile`).then(r => setBotProfile(r.data)).catch(() => {})
  }, [selectedBotId])

  // Load presets from localStorage
  useEffect(() => {
    if (!presetsKey) return
    try {
      const raw = localStorage.getItem(presetsKey)
      if (raw) setPresets(JSON.parse(raw))
    } catch {}
  }, [presetsKey])

  const setField = <K extends keyof EmbedData>(key: K, val: EmbedData[K]) =>
    setEmbed(e => ({ ...e, [key]: val }))

  const addField = () => setEmbed(e => ({ ...e, fields: [...e.fields, { name: '', value: '', inline: false }] }))
  const updateField = (i: number, f: EmbedField) => setEmbed(e => ({ ...e, fields: e.fields.map((x, j) => j === i ? f : x) }))
  const removeField = (i: number) => setEmbed(e => ({ ...e, fields: e.fields.filter((_, j) => j !== i) }))

  const addButton = () => setButtons(b => [...b, { ...DEFAULT_BUTTON }])
  const updateButton = (i: number, b: EmbedButton) => setButtons(bs => bs.map((x, j) => j === i ? b : x))
  const removeButton = (i: number) => setButtons(bs => bs.filter((_, j) => j !== i))

  const handleSend = async () => {
    if (!selectedBotId || !selectedChannelId) return
    setSending(true); setError(null); setSuccess(false)
    try {
      const embedPayload: Record<string, unknown> = {}
      if (embed.title) embedPayload.title = embed.title
      if (embed.description) embedPayload.description = embed.description
      if (embed.color) embedPayload.color = hexToInt(embed.color)
      if (embed.url) embedPayload.url = embed.url
      if (embed.authorName) embedPayload.author = embed.authorName
      if (embed.footerText) embedPayload.footer = embed.footerText
      if (embed.imageUrl) embedPayload.image = embed.imageUrl
      if (embed.thumbnailUrl) embedPayload.thumbnail = embed.thumbnailUrl
      if (embed.fields.filter(f => f.name || f.value).length > 0)
        embedPayload.fields = embed.fields.filter(f => f.name || f.value)

      const resp = await client.post<{ message_id: string }>(`/bots/${selectedBotId}/send-embed`, {
        embed: embedPayload,
        channel_id: selectedChannelId,
        message_id: sentMessageId || undefined,
        content: content || undefined,
        buttons: buttons.filter(b => b.label).map(b => ({
          label: b.label, style: b.style,
          custom_id: b.style !== 5 ? (b.custom_id || b.label.toLowerCase().replace(/ /g, '_')) : undefined,
          url: b.style === 5 ? b.url : undefined,
          emoji: b.emoji || undefined,
          disabled: b.disabled,
        })),
      })
      setSentMessageId(resp.data.message_id)
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } }
      setError(err.response?.data?.detail || 'Fehler beim Senden')
    } finally {
      setSending(false)
    }
  }

  const savePresetsToStorage = (updated: SavedPreset[]) => {
    if (!presetsKey) return
    try { localStorage.setItem(presetsKey, JSON.stringify(updated)) } catch {}
  }

  const handleSavePreset = () => {
    if (!saveName.trim()) return
    setSaving(true)
    const data = { embed, buttons, content }
    const now = new Date().toISOString()
    let updated: SavedPreset[]
    if (currentPresetId) {
      updated = presets.map(p => p.id === currentPresetId
        ? { ...p, name: saveName, bot_id: selectedBotId, channel_id: selectedChannelId || null, data, updated_at: now }
        : p)
    } else {
      const newPreset: SavedPreset = {
        id: Date.now(),
        name: saveName,
        bot_id: selectedBotId,
        channel_id: selectedChannelId || null,
        data,
        updated_at: now,
      }
      updated = [newPreset, ...presets]
      setCurrentPresetId(newPreset.id)
    }
    setPresets(updated)
    savePresetsToStorage(updated)
    setSaveModalOpen(false)
    setSaving(false)
  }

  const handleLoadPreset = (p: SavedPreset) => {
    setEmbed(p.data.embed ?? DEFAULT_EMBED)
    setButtons(p.data.buttons ?? [])
    setContent(p.data.content ?? '')
    if (p.bot_id) setSelectedBotId(p.bot_id)
    if (p.channel_id) setSelectedChannelId(p.channel_id)
    setCurrentPresetId(p.id)
    setSaveName(p.name)
    setShowPresets(false)
    setSentMessageId(null)
  }

  const handleDeletePreset = (id: number) => {
    const updated = presets.filter(p => p.id !== id)
    setPresets(updated)
    savePresetsToStorage(updated)
    if (currentPresetId === id) { setCurrentPresetId(null); setSaveName('') }
  }

  const selectCls = "w-full bg-muted border border-border rounded px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"

  return (
    <div>
      {showPresets && (
        <PresetPanel presets={presets} onLoad={handleLoadPreset} onDelete={handleDeletePreset} onClose={() => setShowPresets(false)} />
      )}
      {saveModalOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50" onClick={() => setSaveModalOpen(false)}>
          <div className="bg-card border border-border rounded-xl w-full max-w-sm mx-4 p-5 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-foreground mb-3">Embed speichern</h3>
            <input
              ref={saveNameRef}
              className="w-full bg-muted border border-border rounded px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary mb-3"
              placeholder="Name..." value={saveName} onChange={e => setSaveName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSavePreset()}
              autoFocus
            />
            <div className="flex gap-2">
              <button onClick={handleSavePreset} disabled={saving || !saveName.trim()}
                className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors">
                {saving ? 'Speichert...' : currentPresetId ? 'Überschreiben' : 'Speichern'}
              </button>
              {currentPresetId && (
                <button onClick={() => { setCurrentPresetId(null); setSaveName('') }}
                  className="px-3 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  title="Als neues Preset speichern">
                  Neu
                </button>
              )}
              <button onClick={() => setSaveModalOpen(false)} className="px-3 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">Abbrechen</button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-6 gap-2 flex-wrap">
        <h2 className="text-2xl font-bold text-foreground">
          Embed Builder
          {currentPresetId && saveName && <span className="ml-2 text-base font-normal text-muted-foreground">— {saveName}</span>}
        </h2>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowPresets(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted border border-border transition-colors">
            <FolderOpen size={14} /> Laden {presets.length > 0 && <span className="text-xs bg-muted-foreground/20 rounded-full px-1.5">{presets.length}</span>}
          </button>
          <button onClick={() => { setSaveModalOpen(true); setTimeout(() => saveNameRef.current?.focus(), 50) }}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted border border-border transition-colors">
            <Save size={14} /> {currentPresetId ? 'Speichern' : 'Speichern als...'}
          </button>
          <button onClick={() => setShowPreview(p => !p)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted border border-border transition-colors">
            {showPreview ? <EyeOff size={14} /> : <Eye size={14} />}
            {showPreview ? 'Vorschau aus' : 'Vorschau an'}
          </button>
        </div>
      </div>

      <div className={`grid gap-6 ${showPreview ? 'lg:grid-cols-2' : 'grid-cols-1 max-w-2xl'}`}>
        {/* Editor */}
        <div className="space-y-4">
          <Section title="Ziel">
            <FieldLabel label="Bot">
              <select className={selectCls} value={selectedBotId ?? ''} onChange={e => setSelectedBotId(Number(e.target.value) || null)}>
                <option value="">Bot auswählen...</option>
                {bots.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </FieldLabel>
            <FieldLabel label="Kanal ID">
              <input
                className="w-full bg-muted border border-border rounded px-2 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                placeholder="z.B. 1482758750552199178"
                value={selectedChannelId}
                onChange={e => setSelectedChannelId(e.target.value.trim())}
              />
            </FieldLabel>
            <FieldLabel label="Nachricht (optional, über dem Embed)">
              <textarea
                className="w-full bg-muted border border-border rounded px-2 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                rows={2} placeholder="Nachrichtentext... (@everyone, @here möglich)"
                value={content} onChange={e => setContent(e.target.value)}
              />
            </FieldLabel>
          </Section>

          <Section title="Embed">
            <FieldLabel label="Farbe">
              <div className="flex items-center gap-2">
                <input type="color" value={embed.color} onChange={e => setField('color', e.target.value)}
                  className="w-10 h-8 rounded border border-border bg-muted cursor-pointer" />
                <Input value={embed.color} onChange={v => setField('color', v)} placeholder="#5865f2" />
              </div>
            </FieldLabel>
            <FieldLabel label="Titel"><Input value={embed.title} onChange={v => setField('title', v)} placeholder="Titel..." /></FieldLabel>
            <FieldLabel label="Titel URL"><Input value={embed.url} onChange={v => setField('url', v)} placeholder="https://..." /></FieldLabel>
            <FieldLabel label="Beschreibung">
              <textarea className="w-full bg-muted border border-border rounded px-2 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                rows={4} placeholder="Beschreibung... (@everyone, @here möglich)" value={embed.description} onChange={e => setField('description', e.target.value)} />
            </FieldLabel>
          </Section>

          <Section title="Author" defaultOpen={false}>
            <FieldLabel label="Name"><Input value={embed.authorName} onChange={v => setField('authorName', v)} placeholder="Autor Name" /></FieldLabel>
            <FieldLabel label="Icon URL"><Input value={embed.authorIconUrl} onChange={v => setField('authorIconUrl', v)} placeholder="https://..." /></FieldLabel>
            <FieldLabel label="URL"><Input value={embed.authorUrl} onChange={v => setField('authorUrl', v)} placeholder="https://..." /></FieldLabel>
          </Section>

          <Section title="Bilder" defaultOpen={false}>
            <FieldLabel label="Bild URL (groß)"><Input value={embed.imageUrl} onChange={v => setField('imageUrl', v)} placeholder="https://..." /></FieldLabel>
            <FieldLabel label="Thumbnail URL (klein, rechts)"><Input value={embed.thumbnailUrl} onChange={v => setField('thumbnailUrl', v)} placeholder="https://..." /></FieldLabel>
          </Section>

          <Section title="Footer" defaultOpen={false}>
            <FieldLabel label="Text"><Input value={embed.footerText} onChange={v => setField('footerText', v)} placeholder="Footer Text" /></FieldLabel>
            <FieldLabel label="Icon URL"><Input value={embed.footerIconUrl} onChange={v => setField('footerIconUrl', v)} placeholder="https://..." /></FieldLabel>
            <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
              <input type="checkbox" checked={embed.timestamp} onChange={e => setField('timestamp', e.target.checked)} />
              Zeitstempel anzeigen
            </label>
          </Section>

          <Section title={`Fields (${embed.fields.length})`} defaultOpen={false}>
            <div className="space-y-2">
              {embed.fields.map((f, i) => <FieldEditor key={i} field={f} onChange={f => updateField(i, f)} onRemove={() => removeField(i)} />)}
            </div>
            {embed.fields.length < 25 && (
              <button onClick={addField} className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-dashed border-border text-sm text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors">
                <Plus size={14} /> Field hinzufügen
              </button>
            )}
          </Section>

          <Section title={`Buttons (${buttons.length})`} defaultOpen={false}>
            <div className="space-y-2">
              {buttons.map((b, i) => <ButtonEditor key={i} btn={b} onChange={b => updateButton(i, b)} onRemove={() => removeButton(i)} />)}
            </div>
            {buttons.length < 25 && (
              <button onClick={addButton} className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-dashed border-border text-sm text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors">
                <Plus size={14} /> Button hinzufügen
              </button>
            )}
          </Section>

          {/* Send */}
          <div className="space-y-2">
            {error && <div className="text-sm text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{error}</div>}
            {success && <div className="text-sm text-green-400 bg-green-500/10 rounded-lg px-3 py-2">{sentMessageId ? 'Embed bearbeitet!' : 'Embed gesendet!'}</div>}
            <div className="flex gap-2">
              <button onClick={handleSend} disabled={sending || !selectedBotId || !selectedChannelId}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                <Send size={15} />
                {sending ? 'Sendet...' : sentMessageId ? 'Embed bearbeiten' : 'Embed senden'}
              </button>
              {sentMessageId && (
                <button onClick={() => setSentMessageId(null)}
                  className="px-3 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  title="Als neue Nachricht senden">Neu</button>
              )}
            </div>
          </div>
        </div>

        {/* Preview */}
        {showPreview && (
          <div className="lg:sticky lg:top-6 h-fit">
            <div className="bg-card border border-border rounded-xl p-4">
              <h3 className="text-sm font-semibold text-foreground mb-3">Vorschau</h3>
              <DiscordPreview embed={embed} buttons={buttons} content={content} botProfile={botProfile} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
