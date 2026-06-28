// apps/web/app/tracks/[isrc]/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import {
  FOCUS_TYPE_LABELS,
  type CurrentUser,
  type ResonancePostDTO,
  type TrackMomentsResponse,
} from '@resonance/shared'
import { AppHeader } from '@/components/AppHeader'
import { TrackCard } from '@/components/TrackCard'
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
    return () => {
      cancelled = true
    }
  }, [isrc])

  return (
    <main className="mx-auto min-h-screen max-w-md px-6 py-10">
      <AppHeader />
      <a href="/resonances" className="text-xs text-accent hover:underline">
        ← Back
      </a>

      {status === 'loading' && <p className="mt-4 text-muted">Loading…</p>}
      {status === 'notfound' && <p className="mt-4 text-muted">No moments on this track yet.</p>}
      {status === 'unauthed' && (
        <a href="/login" className="mt-4 block text-accent hover:underline">
          Go to login →
        </a>
      )}

      {status === 'ready' && data && (
        <div className="mt-4 space-y-6">
          <TrackCard
            title={data.track.title}
            artist={data.track.artist}
            albumArt={data.track.albumArt}
          />

          {data.clusters.map((cluster, i) => {
            const shared = cluster.posts.length > 1
            return (
              <section key={`${cluster.centerMs}-${i}`} className="space-y-2">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold">Moment at {formatTime(cluster.centerMs)}</h2>
                  <span className="text-xs text-muted">
                    {shared ? `${cluster.posts.length} listeners` : 'Unclaimed moment'}
                  </span>
                </div>
                {cluster.posts.map((post) => (
                  <PostRow key={post.id} post={post} isOwn={post.userId === meId} />
                ))}
              </section>
            )
          })}
        </div>
      )}
    </main>
  )
}

function PostRow({ post, isOwn }: { post: ResonancePostDTO; isOwn: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{FOCUS_TYPE_LABELS[post.focusType]}</span>
        <span className="text-xs text-muted">{isOwn ? 'You' : 'Another listener'}</span>
      </div>
      {post.sensoryTags && post.sensoryTags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {post.sensoryTags.map((tag) => (
            <span key={tag} className="rounded-full border border-border px-2 py-0.5 text-xs text-muted">
              {tag}
            </span>
          ))}
        </div>
      )}
      {post.reflection && <p className="mt-2 text-sm">{post.reflection}</p>}
    </div>
  )
}
