// apps/web/src/components/MatchResponse.tsx
'use client'

import {
  FOCUS_TYPE_LABELS,
  type CreatePostResponse,
  type MatchResult,
} from '@resonance/shared'

function MatchCard({ match }: { match: MatchResult }) {
  const { post } = match
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="text-sm font-medium">{FOCUS_TYPE_LABELS[post.focusType]}</div>
      {post.sensoryTags && post.sensoryTags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {post.sensoryTags.map((tag) => (
            <span key={tag} className="rounded-full border border-border px-2 py-0.5 text-xs text-muted">
              {tag}
            </span>
          ))}
        </div>
      )}
      {post.reflection && <p className="mt-2 text-sm text-foreground">{post.reflection}</p>}
      <div className="mt-2 text-xs text-muted">Another listener</div>
    </div>
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
        <section className="space-y-2">
          <h3 className="text-sm font-semibold">Exact resonance</h3>
          <p className="text-xs text-muted">Same moment, same way of hearing it.</p>
          {tier0.map((m) => (
            <MatchCard key={m.post.id} match={m} />
          ))}
        </section>
      )}

      {tier1.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold">Same moment, different lens</h3>
          <p className="text-xs text-muted">Others noticed something else here.</p>
          {tier1.map((m) => (
            <MatchCard key={m.post.id} match={m} />
          ))}
        </section>
      )}
    </div>
  )
}
