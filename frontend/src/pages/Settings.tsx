import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import i18n from '@/i18n'
import client from '@/api/client'

interface AppInfo {
  name: string
  version: string
  build_date: string
  environment: string
}

export default function Settings() {
  const { t } = useTranslation()
  const [info, setInfo] = useState<AppInfo | null>(null)

  useEffect(() => {
    client.get<AppInfo>('/info').then((res) => setInfo(res.data)).catch(() => {})
  }, [])

  const setLanguage = (lang: string) => {
    i18n.changeLanguage(lang)
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-foreground mb-6">{t('settings.title')}</h2>

      <div className="space-y-4 max-w-lg">
        <div className="bg-card border border-border rounded-lg p-5">
          <h3 className="font-semibold text-foreground mb-3">{t('settings.language')}</h3>
          <div className="flex gap-2">
            <button
              onClick={() => setLanguage('de')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${i18n.language === 'de' ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground hover:bg-border'}`}
            >
              DE
            </button>
            <button
              onClick={() => setLanguage('en')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${i18n.language === 'en' ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground hover:bg-border'}`}
            >
              EN
            </button>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-5">
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
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-sans ${info.environment === 'production' ? 'bg-green-500/15 text-green-400' : 'bg-yellow-500/15 text-yellow-400'}`}>
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
        </div>
      </div>
    </div>
  )
}
