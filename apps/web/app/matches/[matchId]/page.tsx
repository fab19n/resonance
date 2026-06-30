// apps/web/app/matches/[matchId]/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import type { MatchDetailResponse, MatchResult } from '@resonance/shared'
import { FOCUS_TYPE_LABELS } from '@resonance/shared'
import { AppHeader } from '@/components/AppHeader'
import { PostCard } from '@/components/PostCard'
import { StartConversationModal } from '@/components/StartConversationModal'

export default function MatchDetailPage() {
  const params = useParams<{ matchId: string }>()
  const matchId = params.matchId

  const [detail, setDetail] = useState<MatchDetailResponse | null>(null)
  const [status, setStatus] = useState<'loading' | 'unauthed' | 'notfound' | 'ready'>('loading')
  const [showStartModal, setShowStartModal] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/matches/${matchId}`)
      .then((res) => {
        if (res.status === 401) {
          if (!cancelled) setStatus('unauthed')
          return null
        }
        if (!res.ok) {
          if (!cancelled) setStatus('notfound')
          return null
        }
        return res.json() as Promise<MatchDetailResponse>
      })
      .then((data) => {
        if (data && !cancelled) {
          setDetail(data)
          setStatus('ready')
        }
      })
      .catch(() => {
        if (!cancelled) setStatus('notfound')
      })
    return () => { cancelled = true }
  }, [matchId])

  if (status === 'loading') {
    return (
      <main className="mx-auto min-h-screen max-w-md px-6 py-10">
        <AppHeader />
        <p className="text-muted">Loading…</p>
      </main>
    )
  }
  if (status === 'unauthed') {
    return (
      <main className="mx-auto min-h-screen max-w-md px-6 py-10">
        <a href="/login" className="text-accent hover:underline">Go to login →</a>
      </main>
    )
  }
  if (status === 'notfound' || !detail) {
    return (
      <main className="mx-auto min-h-screen max-w-md px-6 py-10">
        <AppHeader />
        <p className="text-muted">This match couldn't be found.</p>
      </main>
    )
  }

  const name = detail.otherUser.displayName ?? detail.otherUser.username

  // Adapt the match detail into a MatchResult so StartConversationModal
  // (built for MatchResponse) can be reused here unchanged.
  const matchForModal: MatchResult = {
    post: detail.theirPost,
    matchTier: detail.matchTier,
  }

  return (
    <main className="mx-auto min-h-screen max-w-md px-6 py-10">
      <AppHeader />

      <div className="space-y-6">
        <div>
          <p className="text-sm text-muted">
            {detail.matchTier === 0 ? 'Exact resonance with' : 'Same moment, different lens —'}
          </p>
          <a href={`/u/${detail.otherUser.username}`} className="inline-block hover:opacity-80">
            <h1 className="text-2xl font-semibold tracking-tight">{name}</h1>
          </a>
          <p className="text-sm text-muted">on {detail.track.title} · {detail.track.artist}</p>
        </div>

        <div className="space-y-3">
          <div>
            <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted">You captured</p>
            <PostCard post={detail.myPost} isOwn />
          </div>
          <div>
            <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted">
              {name} captured
            </p>
            <PostCard post={detail.theirPost} isOwn={false} postOwner={detail.otherUser} />
          </div>
        </div>

        {detail.conversationId ? (
          <a
            href={`/messages/${detail.conversationId}`}
            className="block rounded-full bg-accent py-3 text-center text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90"
          >
            {detail.conversationStatus === 'active' ? 'View conversation' : 'View your message'}
          </a>
        ) : (
          <button
            type="button"
            onClick={() => setShowStartModal(true)}
            className="block w-full rounded-full bg-accent py-3 text-center text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90"
          >
            Start a conversation
          </button>
        )}
      </div>

      {showStartModal && (
        <StartConversationModal
          match={matchForModal}
          trackTitle={detail.track.title}
          onSent={(conversationId) => { window.location.href = `/messages/${conversationId}` }}
          onDismiss={() => setShowStartModal(false)}
        />
      )}
    </main>
  )
}
