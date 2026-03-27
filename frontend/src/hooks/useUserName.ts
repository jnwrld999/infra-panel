import { useEffect, useState } from 'react'
import client from '@/api/client'

const cache: Record<string, string> = {}
let loaded = false
let promise: Promise<void> | null = null

function load() {
  if (!promise) {
    promise = client.get('/users/').then((r) => {
      for (const u of r.data) cache[u.discord_id] = u.username
      loaded = true
    }).catch(() => { loaded = true })
  }
  return promise
}

export function useUserName(discordId: string | null | undefined): string {
  const [name, setName] = useState(discordId ? (cache[discordId] ?? discordId) : '—')
  useEffect(() => {
    if (!discordId) return
    load().then(() => setName(cache[discordId] ?? discordId))
  }, [discordId])
  return name
}
