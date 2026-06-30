// apps/web/app/resonances/page.tsx
'use client'

import { useEffect, useState } from 'react'
import type { MyResonancesResponse, MyResonanceItem } from '@resonance/shared'
import { AppHeader } from '@/components/AppHeader'
import { PostCard } from '@/components/PostCard'

export default function ResonancesPage() {
  const [items, setItems] = useState<MyResonanceItem[]>([])
  const [status, setStatus] = useState<'loading' | 'unauthed' | 'ready'>('loading')

  useEffect(() => {
    let cancelled = false
    fetch('/api/posts/mine')
      .then((res) => {
        if (!res.ok) {
          if (!cancelled) setStatus('unauthed')
          return null
        }
        return res.json() as Promise<MyResonancesResponse>
      })
      .then((data) => {
        if (data && !cancelled) {
          setItems(data.items)
          setStatus('ready')
        }
      })
      .catch(() => {
        if (!cancelled) setStatus('unauthed')
      })
    return () => { cancelled = true }
  }, [])

  return (
    <main className="mx-auto min-h-screen max-w-md px-6 py-10">
      <AppHeader active="resonances" />
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">My Resonances</h1>

      {status === 'loading' && <p className="text-muted">Loading…</p>}
      {status === 'unauthed' && (
        <a href="/login" className="text-accent hover:underline">
          Go to login →
        </a>
      )}
      {status === 'ready' && items.length === 0 && (
        <p className="text-muted">
          No moments yet. Capture your first one and your listening identity starts to form.
        </p>
      )}

      {status === 'ready' && items.length > 0 && (
        <ul className="space-y-3">
          {items.map(({ post, track, matchCount }) => (
            <li key={post.id}>
              <PostCard
                post={post}
                track={track}
                matchCount={matchCount}
                isOwn
                href={`/tracks/${encodeURIComponent(track.isrc)}`}
              />
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
