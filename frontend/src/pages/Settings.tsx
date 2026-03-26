import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import i18n from '@/i18n'
import client from '@/api/client'
import { useUIStore } from '@/store/uiStore'
import type { Theme } from '@/store/uiStore'
import { Check, AlertTriangle } from 'lucide-react'
import { Toggle } from '@/components/Toggle'

interface AppInfo {
  name: string
  version: string
  build_date: string
  environment: string
}

// Theme preview swatches — small visual color samples
const THEME_PREVIEWS: Record<Theme, { bg: string; card: string; primary: string; label: string }> = {
  dark:       { bg: '#0b1120', card: '#0d1526', primary: '#3b82f6', label: 'Dark' },
  light:      { bg: '#f9fafb', card: '#ffffff', primary: '#3b82f6', label: 'Light' },
  monokai:    { bg: '#272822', card: '#2d2e2a', primary: '#a6e22e', label: 'Monokai' },
  dracula:    { bg: '#282a36', card: '#21222c', primary: '#bd93f9', label: 'Dracula' },
  nord:       { bg: '#2e3440', card: '#3b4252', primary: '#88c0d0', label: 'Nord' },
  solarized:  { bg: '#002b36', card: '#073642', primary: '#268bd2', label: 'Solarized' },
  catppuccin: { bg: '#1e1e2e', card: '#181825', primary: '#cba6f7', label: 'Catppuccin' },
  onedark:    { bg: '#21252b', card: '#282c34', primary: '#61afef', label: 'One Dark' },
}

const FONT_SIZES = [
  { value: 'small' as const, label: 'Klein', size: 'text-xs' },
  { value: 'normal' as const, label: 'Normal', size: 'text-sm' },
  { value: 'large' as const, label: 'Groß', size: 'text-base' },
]

const themeEntries = Object.entries(THEME_PREVIEWS) as Array<
  [Theme, (typeof THEME_PREVIEWS)[keyof typeof THEME_PREVIEWS]]
>

export default function Settings() {
  const { t } = useTranslation()
  const { theme, fontSize, setTheme, setFontSize, stayLoggedIn, setStayLoggedIn, devMode, setDevMode } = useUIStore()
  const [info, setInfo] = useState<AppInfo | null>(null)

  useEffect(() => {
    client.get<AppInfo>('/info').then((r) => setInfo(r.data)).catch(() => {})
  }, [])

  return (
    <div>
      <h2 className="text-2xl font-bold text-foreground mb-6">{t('settings.title')}</h2>

      <div className="space-y-6 max-w-xl">

        {/* Theme picker */}
        <section className="bg-card border border-border rounded-xl p-5">
          <h3 className="font-semibold text-foreground mb-4">Design / Theme</h3>
          <div className="grid grid-cols-4 gap-3">
            {themeEntries.map(([key, preview]) => (
              <button
                key={key}
                onClick={() => setTheme(key)}
                className={`relative rounded-lg overflow-hidden border-2 transition-all ${
                  theme === key ? 'border-primary shadow-md scale-[1.02]' : 'border-border hover:border-muted-foreground'
                }`}
              >
                {/* Mini preview */}
                <div style={{ background: preview.bg }} className="h-16 p-2 flex flex-col gap-1">
                  <div style={{ background: preview.card }} className="flex-1 rounded-md p-1 flex items-end">
                    <div style={{ background: preview.primary }} className="h-1.5 w-8 rounded-full" />
                  </div>
                </div>
                {/* Label */}
                <div className="px-2 py-1.5 flex items-center justify-between bg-muted text-xs font-medium text-foreground">
                  <span>{preview.label}</span>
                  {theme === key && <Check size={12} className="text-primary" />}
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* Font size picker */}
        <section className="bg-card border border-border rounded-xl p-5">
          <h3 className="font-semibold text-foreground mb-4">Schriftgröße</h3>
          <div className="flex gap-3">
            {FONT_SIZES.map((item) => (
              <button
                key={item.value}
                onClick={() => setFontSize(item.value)}
                className={`flex-1 flex flex-col items-center gap-2 py-3 px-2 rounded-lg border-2 transition-all ${
                  fontSize === item.value
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-muted-foreground'
                }`}
              >
                <span className={`font-semibold text-foreground ${item.size}`}>Aa</span>
                <span className="text-xs text-muted-foreground">{item.label}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Language selector — Apple sliding pill */}
        <section className="bg-card border border-border rounded-xl p-5">
          <h3 className="font-semibold text-foreground mb-4">{t('settings.language')}</h3>
          <LanguageSelector />
        </section>

        {/* Security */}
        <section className="bg-card border border-border rounded-xl p-5">
          <h3 className="font-semibold text-foreground mb-4">Sicherheit</h3>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-foreground">30 Tage angemeldet bleiben</p>
              <p className="text-xs text-muted-foreground mt-0.5">Session wird automatisch auf 30 Tage verlängert</p>
            </div>
            <Toggle checked={stayLoggedIn} onChange={setStayLoggedIn} />
          </div>
          {stayLoggedIn && (
            <p className="mt-3 text-xs text-primary/80 flex items-center gap-1.5">
              <Check size={11} /> Aktiv — nächste Anmeldung läuft 30 Tage
            </p>
          )}
        </section>

        {/* Developer */}
        <section className="bg-card border border-border rounded-xl p-5">
          <h3 className="font-semibold text-foreground mb-4">Entwickler</h3>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-foreground">Dev-Modus</p>
              <p className="text-xs text-muted-foreground mt-0.5">Zusätzliche Logs: Button-Klicks, API-Calls, UI-Events</p>
            </div>
            <Toggle checked={devMode} onChange={setDevMode} color="bg-yellow-500" />
          </div>
          {devMode && (
            <div className="mt-3 flex items-center gap-2 text-xs text-yellow-400 bg-yellow-500/10 rounded-lg px-3 py-2">
              <AlertTriangle size={12} />
              Dev-Modus aktiv — alle Interaktionen werden protokolliert
            </div>
          )}
        </section>

        {/* About */}
        <section className="bg-card border border-border rounded-xl p-5">
          <h3 className="font-semibold text-foreground mb-3">{t('settings.about')}</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">App</span>
              <span className="text-foreground font-medium">{info?.name ?? 'InfraPanel'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('settings.version')}</span>
              <span className="text-foreground font-mono">
                {info ? (
                  <span className="inline-flex items-center gap-1.5">
                    v{info.version}
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-sans ${
                      info.environment === 'production'
                        ? 'bg-green-500/15 text-green-400'
                        : 'bg-yellow-500/15 text-yellow-400'
                    }`}>
                      {info.environment}
                    </span>
                  </span>
                ) : '…'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('settings.buildDate')}</span>
              <span className="text-foreground font-mono text-xs">{info?.build_date ?? '…'}</span>
            </div>
          </div>
        </section>

        {/* Changelog */}
        <section className="bg-card border border-border rounded-xl p-5">
          <h3 className="font-semibold text-foreground mb-4">Versionsverlauf</h3>
          <div className="space-y-4">
            {[
              {
                version: '1.1.0',
                date: '2026-03-25',
                changes: [
                  'Toggle-Darstellung in allen Themes korrigiert',
                  'Discord Profilbild in der Sidebar',
                  'Server-Status: automatische Prüfung bei Unknown',
                  'Nutzer hinzufügen Funktion',
                  'Anfragen per Discord-DM',
                  'HomeServer Bots korrekt zugeordnet (Harryoe, CarstenBot, Asker)',
                  'Sync: Job erstellen + Ausgabe-Fix',
                  'Plugin-Fehler werden sauber angezeigt',
                  '30-Tage-Option direkt beim Login',
                  'Englische Übersetzungen erweitert',
                ],
              },
              {
                version: '1.0.0',
                date: '2026-03-25',
                changes: [
                  'Discord OAuth2 Login mit 30-Tage-Session-Option',
                  'Server-Verwaltung mit SSH (Live/Offline Status)',
                  'Plugin-Übersicht für Minecraft und Discord-Bots',
                  'Bot-Verwaltung mit Cog-Viewer (Java/Python/Node.js)',
                  'Dashboard mit anpassbaren Panels',
                  '8 Themes: Dark, Light, Monokai, Dracula, Nord, Solarized, Catppuccin, One Dark',
                  'Nutzer-Verwaltung mit Rollen und Rechten',
                  'Dev-Modus mit erweitertem Logging',
                ],
              },
            ].map(entry => (
              <div key={entry.version}>
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-sm font-mono font-semibold text-foreground">v{entry.version}</span>
                  <span className="text-xs text-muted-foreground">{entry.date}</span>
                  <span className="text-xs px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">aktuell</span>
                </div>
                <ul className="space-y-1">
                  {entry.changes.map((c, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                      <span className="text-primary mt-0.5 flex-shrink-0">•</span>
                      <span>{c}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

      </div>
    </div>
  )
}

// Apple-style language selector with sliding pill
const LANGUAGES = [
  { code: 'de', flag: '🇩🇪', label: 'Deutsch' },
  { code: 'en', flag: '🇬🇧', label: 'English' },
]

function LanguageSelector() {
  const currentLang = i18n.language?.startsWith('de') ? 'de' : 'en'
  const activeIdx = LANGUAGES.findIndex((l) => l.code === currentLang)

  const handleSelect = (code: string) => {
    i18n.changeLanguage(code)
  }

  return (
    <div className="inline-flex relative bg-muted rounded-xl p-1 gap-0">
      {/* Sliding background pill */}
      <div
        className="absolute top-1 bottom-1 rounded-lg bg-card shadow-sm transition-transform duration-300 ease-in-out"
        style={{
          width: `calc(50% - 4px)`,
          transform: `translateX(${activeIdx * 100}%)`,
          left: '4px',
        }}
      />
      {LANGUAGES.map((lang) => (
        <button
          key={lang.code}
          onClick={() => handleSelect(lang.code)}
          className={`relative z-10 flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors duration-200 ${
            currentLang === lang.code ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <span className="text-base leading-none">{lang.flag}</span>
          <span>{lang.label}</span>
        </button>
      ))}
    </div>
  )
}
