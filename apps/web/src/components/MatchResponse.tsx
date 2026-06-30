// apps/web/src/components/MatchResponse.tsx
'use client'

import type { CreatePostResponse, MatchResult } from '@resonance/shared'
import { PostCard } from './PostCard'

function MatchSection({
  title,
  subtitle,
  matches,
}: {
  title: string
  subtitle: string
  matches: MatchResult[]
}) {
  return (
    <section className="space-y-2">
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="text-xs text-muted">{subtitle}</p>
      </div>
      {matches.map((m) => (
        <PostCard key={m.post.id} post={m.post} isOwn={false} />
      ))}
    </section>
  )
}

export function MatchResponse({ result }: { result: CreatePostResponse }) {
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
        />
      )}
      {tier1.length > 0 && (
        <MatchSection
          title="Same moment, different lens"
          subtitle="Others noticed something else here."
          matches={tier1}
        />
      )}
    </div>
  )
}
