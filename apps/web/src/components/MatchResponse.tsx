// apps/web/src/components/MatchResponse.tsx
'use client'

import { useState } from 'react'
import type { CreatePostResponse, MatchResult } from '@resonance/shared'
import { PostCard } from './PostCard'
import { StartConversationModal } from './StartConversationModal'

function MatchCard({ match, trackTitle }: { match: MatchResult; trackTitle: string }) {
  const [showModal, setShowModal] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(match.conversationId ?? null)
  const [conversationStatus, setConversationStatus] = useState(match.conversationStatus ?? null)

  return (
    <div className="space-y-2">
      <PostCard post={match.post} isOwn={false} postOwner={match.postOwner} />

      {conversationId ? (
        <a
          href={`/messages/${conversationId}`}
          className="block rounded-full border border-accent/30 py-2 text-center text-xs font-medium text-accent transition-colors hover:bg-accent/5"
        >
          {conversationStatus === 'active' ? 'View conversation' : 'View your message'}
        </a>
      ) : (
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="block w-full rounded-full border border-accent/30 py-2 text-center text-xs font-medium text-accent transition-colors hover:bg-accent/5"
        >
          Start a conversation
        </button>
      )}

      {showModal && (
        <StartConversationModal
          match={match}
          trackTitle={trackTitle}
          onSent={(id) => {
            setConversationId(id)
            setConversationStatus('pending')
            setShowModal(false)
          }}
          onDismiss={() => setShowModal(false)}
        />
      )}
    </div>
  )
}

function MatchSection({
  title,
  subtitle,
  matches,
  trackTitle,
}: {
  title: string
  subtitle: string
  matches: MatchResult[]
  trackTitle: string
}) {
  return (
    <section className="space-y-2">
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="text-xs text-muted">{subtitle}</p>
      </div>
      {matches.map((m) => (
        <MatchCard key={m.post.id} match={m} trackTitle={trackTitle} />
      ))}
    </section>
  )
}

export function MatchResponse({
  result,
  trackTitle,
}: {
  result: CreatePostResponse
  trackTitle: string
}) {
  if (result.isPioneer) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5 text-center">
        <div className="text-base font-medium">You're the first to capture this moment.</div>
        <p className="mt-2 text-sm text-muted">
          We'll let you know when someone else resonates here.
        </p>
      </div>
    )
  }

  const tier0 = result.matches.filter((m) => m.matchTier === 0)
  const tier1 = result.matches.filter((m) => m.matchTier === 1)

  return (
    <div className="space-y-5">
      {tier0.length > 0 && (
        <MatchSection
          title="Exact resonance"
          subtitle="Same moment, same way of hearing it."
          matches={tier0}
          trackTitle={trackTitle}
        />
      )}
      {tier1.length > 0 && (
        <MatchSection
          title="Same moment, different lens"
          subtitle="Others noticed something else here."
          matches={tier1}
          trackTitle={trackTitle}
        />
      )}
    </div>
  )
}
