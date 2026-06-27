// apps/web/app/home/page.tsx
'use client'

import { useEffect, useState } from 'react'
import type { CurrentUser } from '@resonance/shared'
import { ThemeToggle } from '@/components/ThemeToggle'
import { CaptureFlow } from '@/components/CaptureFlow'

export default function HomePage() {
  const [user, setUser] = useState<CurrentUser | null>(null)
  const [status, setStatus] = useState<'loading' | 'unauthed' | 'ready'>('loading')

  useEffect(() => {
    let cancelled = false
    fetch('/api/auth/me')
      .then((res) => {
        if (!res.ok) {
          if (!cancelled) setStatus('unauthed')
          return null
        }
        return res.json() as Promise<CurrentUser>
      })
      .then((me) => {
        if (me && !cancelled) {
          setUser(me)
          setStatus('ready')
        }
      })
      .catch(() => {
        if (!cancelled) setStatus('unauthed')
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <main className="mx-auto min-h-screen max-w-md px-6 py-10">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Resonance</h1>
          {user && <p className="text-xs text-muted">@{user.username}</p>}
        </div>
        <ThemeToggle />
      </header>

      {status === 'loading' && <p className="text-muted">Loading…</p>}

      {status === 'unauthed' && (
        <div>
          <p className="text-muted">You are not signed in.</p>
          <a href="/login" className="mt-2 inline-block text-accent hover:underline">
            Go to login →
          </a>
        </div>
      )}

      {status === 'ready' && <CaptureFlow />}
    </main>
  )
}
