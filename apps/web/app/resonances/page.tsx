// apps/web/app/resonances/page.tsx
'use client'

import { useEffect, useState } from 'react'
import {
  FOCUS_TYPE_LABELS,
  type MyResonancesResponse,
  type MyResonanceItem,
} from '@resonance/shared'
import { AppHeader } from '@/components/AppHeader'

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
    return () => {
      cancelled = true
    }
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
              <a
                href={`/tracks/${encodeURIComponent(track.isrc)}`}
                className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-accent"
              >
                {track.albumArt && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={track.albumArt} alt="" width={56} height={56} className="rounded-lg" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{track.title}</div>
                  <div className="truncate text-sm text-muted">{track.artist}</div>
                  <div className="mt-1 text-xs text-muted">
                    {FOCUS_TYPE_LABELS[post.focusType]}
                    {post.sensoryTags && post.sensoryTags.length > 0
                      ? ` · ${post.sensoryTags.join(', ')}`
                      : ''}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-sm font-semibold">{matchCount}</div>
                  <div className="text-xs text-muted">{matchCount === 1 ? 'match' : 'matches'}</div>
                </div>
              </a>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
