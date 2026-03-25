import { X, Sparkles } from 'lucide-react'

interface WhatsNewModalProps {
  version: string
  onClose: () => void
}

const CHANGELOG: Record<string, { features: string[]; improvements: string[]; fixes: string[] }> = {
  '1.0.0': {
    features: [
      'Vollständiges Server-Management via SSH (RSA + Ed25519)',
      'Discord OAuth2 Login mit Rollen-System (Owner, Admin, Operator, Viewer)',
      'Plugin-Verwaltung für Minecraft (.jar) und Discord Bots (Cogs)',
      'Service-Manager für Systemd, Docker und PM2',
      'Synchronisations-Jobs mit Dry-Run Modus',
      'Discord-Bot mit Slash-Commands (/status, /restart, /suggest)',
      'Audit-Log und strukturiertes Logging',
      'Freigabe-/Approval-Workflow',
    ],
    improvements: [
      'Verschlüsselte Bot-Token-Speicherung (Fernet)',
      'JWT Token-Rotation mit Blocklist',
      'Rate Limiting und CORS-Absicherung',
    ],
    fixes: [],
  },
}

export function WhatsNewModal({ version, onClose }: WhatsNewModalProps) {
  const log = CHANGELOG[version] ?? {
    features: ['Neue Version verfügbar'],
    improvements: [],
    fixes: [],
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-5 border-b border-border flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles size={18} className="text-primary" />
              <span className="text-xs font-medium text-primary uppercase tracking-widest">Was ist neu</span>
            </div>
            <h2 className="text-xl font-bold text-foreground">Version {version}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex-shrink-0">
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-5 space-y-5">
          {log.features.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold text-primary uppercase tracking-widest mb-3">Neue Funktionen</h3>
              <ul className="space-y-2">
                {log.features.map((f, i) => (
                  <li key={i} className="flex gap-2 text-sm text-foreground">
                    <span className="text-primary mt-0.5 flex-shrink-0">✦</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {log.improvements.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold text-yellow-400 uppercase tracking-widest mb-3">Verbesserungen</h3>
              <ul className="space-y-2">
                {log.improvements.map((imp, i) => (
                  <li key={i} className="flex gap-2 text-sm text-muted-foreground">
                    <span className="text-yellow-400 mt-0.5 flex-shrink-0">◆</span>
                    <span>{imp}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {log.fixes.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold text-green-400 uppercase tracking-widest mb-3">Bugfixes</h3>
              <ul className="space-y-2">
                {log.fixes.map((fix, i) => (
                  <li key={i} className="flex gap-2 text-sm text-muted-foreground">
                    <span className="text-green-400 mt-0.5 flex-shrink-0">●</span>
                    <span>{fix}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border">
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            Verstanden
          </button>
        </div>
      </div>
    </div>
  )
}
