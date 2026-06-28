// apps/web/app/home/page.tsx
'use client'

import { useEffect, useState } from 'react'
import type { CurrentUser } from '@resonance/shared'
import { AppHeader } from '@/components/AppHeader'
import { CaptureFlow } from '@/components/CaptureFlow'

export default function HomePage() {
  const [status, setStatus] = useState<'loading' | 'unauthed' | 'ready'>('loading')

  useEffect(() => {
    let cancelled = false
    fetch('/api/auth/me')
      .then((res) => {
        if (!cancelled) setStatus(res.ok ? 'ready' : 'unauthed')
        return res.ok ? (res.json() as Promise<CurrentUser>) : null
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
      <AppHeader active="capture" />

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
