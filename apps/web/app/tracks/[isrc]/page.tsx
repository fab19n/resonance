// apps/web/app/tracks/[isrc]/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import type { CurrentUser, TrackMomentsResponse } from '@resonance/shared'
import { AppHeader } from '@/components/AppHeader'
import { PostCard } from '@/components/PostCard'
import { formatTime } from '@/lib/format'

export default function TrackPage() {
  const params = useParams<{ isrc: string }>()
  const isrc = params.isrc
  const [data, setData] = useState<TrackMomentsResponse | null>(null)
  const [meId, setMeId] = useState<string | null>(null)
  const [status, setStatus] = useState<'loading' | 'unauthed' | 'notfound' | 'ready'>('loading')

  useEffect(() => {
    let cancelled = false
    async function load() {
      const meRes = await fetch('/api/auth/me')
      if (!meRes.ok) {
        if (!cancelled) setStatus('unauthed')
        return
      }
      const me = (await meRes.json()) as CurrentUser
      const res = await fetch(`/api/tracks/${encodeURIComponent(isrc)}/moments`)
      if (res.status === 404) {
        if (!cancelled) setStatus('notfound')
        return
      }
      if (!res.ok) {
        if (!cancelled) setStatus('unauthed')
        return
      }
      const moments = (await res.json()) as TrackMomentsResponse
      if (!cancelled) {
        setMeId(me.id)
        setData(moments)
        setStatus('ready')
      }
    }
    void load()
    return () => { cancelled = true }
  }, [isrc])

  return (
    <main className="mx-auto min-h-screen max-w-md px-6 py-10">
      <AppHeader />
      <a href="/resonances" className="text-xs text-accent hover:underline">
        ← Back
      </a>

      {status === 'loading' && <p className="mt-4 text-muted">Loading…</p>}
      {status === 'notfound' && (
        <p className="mt-4 text-muted">No moments on this track yet.</p>
      )}
      {status === 'unauthed' && (
        <a href="/login" className="mt-4 block text-accent hover:underline">
          Go to login →
        </a>
      )}

      {status === 'ready' && data && (
        <div className="mt-4 space-y-6">
          {/* Track header */}
          <div className="flex items-center gap-3">
            {data.track.albumArt ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={data.track.albumArt}
                alt=""
                width={56}
                height={56}
                className="rounded-xl"
              />
            ) : (
              <div className="h-14 w-14 rounded-xl bg-border" />
            )}
            <div className="min-w-0">
              <p className="truncate font-semibold">{data.track.title}</p>
              <p className="truncate text-sm text-muted">{data.track.artist}</p>
              <p className="text-xs text-muted/60">
                {formatTime(data.track.durationMs)}
              </p>
            </div>
          </div>

          {/* Moment clusters */}
          {data.clusters.map((cluster, i) => {
            const shared = cluster.posts.length > 1
            return (
              <section key={`${cluster.centerMs}-${i}`} className="space-y-2">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold">
                    Moment at {formatTime(cluster.centerMs)}
                  </h2>
                  <span className="text-xs text-muted">
                    {shared
                      ? `${cluster.posts.length} listeners`
                      : 'Unclaimed moment'}
                  </span>
                </div>
                {cluster.posts.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    isOwn={post.userId === meId}
                  />
                ))}
              </section>
            )
          })}
        </div>
      )}
    </main>
  )
}
