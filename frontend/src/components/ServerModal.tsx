import { useState } from 'react'
import { X, Plug, Loader } from 'lucide-react'
import client from '@/api/client'

interface Server {
  id: number
  name: string
  host: string
  port: number
  ssh_user: string
  ssh_key_path?: string | null
  description?: string | null
  tags: string[]
  status: string
}

interface ServerModalProps {
  server?: Server | null
  onClose: () => void
  onSave: () => void
}

export function ServerModal({ server, onClose, onSave }: ServerModalProps) {
  const isEdit = !!server
  const [form, setForm] = useState({
    name: server?.name ?? '',
    host: server?.host ?? '',
    port: server?.port ?? 22,
    ssh_user: server?.ssh_user ?? 'root',
    ssh_key_path: server?.ssh_key_path ?? '',
    description: server?.description ?? '',
    tags: server?.tags?.join(', ') ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const set = (field: string, value: string | number) =>
    setForm((prev) => ({ ...prev, [field]: value }))

  const handleTest = async () => {
    if (!server?.id) return
    setTesting(true)
    setTestResult(null)
    try {
      const r = await client.post(`/servers/${server.id}/test-connection`)
      setTestResult({ ok: r.data.status !== 'error', message: r.data.message ?? r.data.status })
    } catch (e: any) {
      setTestResult({ ok: false, message: e?.response?.data?.detail ?? 'Verbindungsfehler' })
    } finally {
      setTesting(false)
    }
  }

  const handleSave = async () => {
    if (!form.name.trim() || !form.host.trim()) {
      setError('Name und Host sind erforderlich.')
      return
    }
    setSaving(true)
    setError(null)
    const payload = {
      name: form.name.trim(),
      host: form.host.trim(),
      port: Number(form.port),
      ssh_user: form.ssh_user.trim() || 'root',
      ssh_key_path: form.ssh_key_path.trim() || null,
      description: form.description.trim() || null,
      tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
    }
    try {
      if (isEdit && server) {
        await client.patch(`/servers/${server.id}`, payload)
      } else {
        await client.post('/servers/', payload)
      }
      onSave()
      onClose()
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? 'Speichern fehlgeschlagen.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-base font-semibold text-foreground">
            {isEdit ? 'Server bearbeiten' : 'Server hinzufügen'}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Form */}
        <div className="px-5 py-4 space-y-4">
          {/* Name */}
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Name *</span>
            <input
              type="text"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="Mein Server"
              className="mt-1 w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition"
            />
          </label>

          {/* Host + Port */}
          <div className="flex gap-3">
            <label className="flex-1 block">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Host / IP *</span>
              <input
                type="text"
                value={form.host}
                onChange={(e) => set('host', e.target.value)}
                placeholder="192.168.1.1"
                className="mt-1 w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition"
              />
            </label>
            <label className="w-24 block">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Port</span>
              <input
                type="number"
                value={form.port}
                onChange={(e) => set('port', parseInt(e.target.value) || 22)}
                className="mt-1 w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition"
              />
            </label>
          </div>

          {/* SSH User */}
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">SSH User</span>
            <input
              type="text"
              value={form.ssh_user}
              onChange={(e) => set('ssh_user', e.target.value)}
              placeholder="root"
              className="mt-1 w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition"
            />
          </label>

          {/* SSH Key Path */}
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">SSH Key Pfad</span>
            <input
              type="text"
              value={form.ssh_key_path}
              onChange={(e) => set('ssh_key_path', e.target.value)}
              placeholder="/root/.ssh/id_rsa"
              className="mt-1 w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition"
            />
          </label>

          {/* Description */}
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Beschreibung</span>
            <textarea
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              rows={2}
              placeholder="Optionale Beschreibung..."
              className="mt-1 w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition resize-none"
            />
          </label>

          {/* Tags */}
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Tags</span>
            <input
              type="text"
              value={form.tags}
              onChange={(e) => set('tags', e.target.value)}
              placeholder="minecraft, prod, eu-west"
              className="mt-1 w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition"
            />
            <p className="mt-1 text-xs text-muted-foreground">Kommagetrennt</p>
          </label>

          {/* Test connection result */}
          {testResult && (
            <div className={`text-sm px-3 py-2 rounded-lg ${testResult.ok ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
              {testResult.ok ? '✓ ' : '✗ '}{testResult.message}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="text-sm px-3 py-2 rounded-lg bg-red-500/10 text-red-400">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-border gap-3">
          {/* Test connection button (edit mode only) */}
          <button
            onClick={handleTest}
            disabled={!isEdit || testing}
            title={!isEdit ? 'Erst speichern, dann testen' : 'SSH-Verbindung testen'}
            className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {testing ? <Loader size={14} className="animate-spin" /> : <Plug size={14} />}
            Verbindung testen
          </button>

          <div className="flex gap-2 ml-auto">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              Abbrechen
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {saving && <Loader size={14} className="animate-spin" />}
              Speichern
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
