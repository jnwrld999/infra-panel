import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/store/authStore'

const LS_USER_KEY = 'infra-panel-user'

interface CachedUser {
  discord_id: string
  username: string
  avatar_url?: string | null
}

function loadCachedUser(): CachedUser | null {
  try {
    const raw = localStorage.getItem(LS_USER_KEY)
    return raw ? (JSON.parse(raw) as CachedUser) : null
  } catch {
    return null
  }
}

function DiscordIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
    </svg>
  )
}

export default function Login() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { user, fetchMe } = useAuthStore()
  const [cachedUser] = useState<CachedUser | null>(loadCachedUser)
  const [resuming, setResuming] = useState(false)
  const [resumeError, setResumeError] = useState(false)
  const [showDiscord, setShowDiscord] = useState(!cachedUser)
  const autoResumeAttempted = useRef(false)

  // Already authenticated → go to dashboard
  useEffect(() => {
    if (user) navigate('/', { replace: true })
  }, [user, navigate])

  // Auto-resume: if we have a cached user, try to reconnect automatically on mount
  useEffect(() => {
    if (cachedUser && !autoResumeAttempted.current && !user) {
      autoResumeAttempted.current = true
      handleResume()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleResume = async () => {
    setResuming(true)
    setResumeError(false)
    await fetchMe()
    const { user: u } = useAuthStore.getState()
    if (!u) {
      setResumeError(true)
      setShowDiscord(true)
    }
    setResuming(false)
  }

  const avatarUrl = cachedUser?.avatar_url
    ?? `https://cdn.discordapp.com/embed/avatars/${parseInt(cachedUser?.discord_id ?? '0') % 6}.png`

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="bg-card border border-border rounded-xl p-8 w-full max-w-sm shadow-xl">
        <div className="text-center mb-7">
          <h1 className="text-2xl font-bold text-foreground">InfraPanel</h1>
          <p className="text-muted-foreground text-sm mt-1">Bot Management Panel</p>
        </div>

        {cachedUser && !showDiscord ? (
          <>
            {/* Account card */}
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted border border-border mb-4">
              <img
                src={avatarUrl}
                alt=""
                className="w-10 h-10 rounded-full flex-shrink-0 object-cover"
                onError={(e) => { (e.currentTarget as HTMLImageElement).src = `https://cdn.discordapp.com/embed/avatars/0.png` }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{cachedUser.username}</p>
                <p className="text-xs text-muted-foreground">Discord Account</p>
              </div>
            </div>

            {resumeError && (
              <p className="text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2 mb-3 text-center">
                {t('auth.sessionExpired')}
              </p>
            )}

            <button
              onClick={handleResume}
              disabled={resuming}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 disabled:opacity-60 transition-colors"
            >
              {resuming ? (
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
              ) : null}
              {resuming ? t('auth.connecting') : t('auth.continueAs', { name: cachedUser.username })}
            </button>

            <button
              onClick={() => setShowDiscord(true)}
              className="w-full mt-3 text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
            >
              {t('auth.useOtherAccount')}
            </button>
          </>
        ) : (
          <>
            {cachedUser && (
              <button
                onClick={() => setShowDiscord(false)}
                className="w-full mb-3 text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
              >
                {t('auth.backTo', { name: cachedUser.username })}
              </button>
            )}
            <a
              href={`/auth/discord/login${localStorage.getItem('infra-stay-logged-in') === '0' ? '' : '?stay=1'}`}
              className="flex items-center justify-center gap-3 px-6 py-3 rounded-lg bg-[#5865F2] hover:bg-[#4752c4] text-white font-semibold transition-colors w-full"
            >
              <DiscordIcon />
              {t('auth.loginWithDiscord')}
            </a>
          </>
        )}
      </div>
    </div>
  )
}
