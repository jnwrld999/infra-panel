import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

export default function NoAccess() {
  const { t } = useTranslation()
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="bg-card border border-border rounded-lg p-10 w-full max-w-sm text-center shadow-xl">
        <div className="text-5xl mb-4">🔒</div>
        <h1 className="text-2xl font-bold text-foreground mb-3">{t('auth.noAccess')}</h1>
        <p className="text-muted-foreground text-sm mb-6">{t('auth.noAccessDesc')}</p>
        <Link
          to="/login"
          className="text-primary hover:underline text-sm"
        >
          ← Zurück zum Login
        </Link>
      </div>
    </div>
  )
}
