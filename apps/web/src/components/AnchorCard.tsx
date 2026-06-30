// apps/web/src/components/AnchorCard.tsx
//
// Shows the matched moment that anchors a conversation (or part of one).
// Appears at conversation creation, and again whenever a new match is found
// between two people who are already talking.

'use client'

import type { MatchAnchorDTO } from '@resonance/shared'
import { FOCUS_TYPE_LABELS } from '@resonance/shared'
import { formatMoment } from '@/lib/format'
import { usePlayAt } from '@/lib/usePlayAt'

export function AnchorCard({ anchor }: { anchor: MatchAnchorDTO }) {
  const { play, status, message } = usePlayAt()

  return (
    <div className="mx-auto max-w-[90%] space-y-2 rounded-2xl border border-accent/25 bg-accent/5 p-3.5">
      <div className="flex items-center gap-2 text-xs text-accent">
        <span aria-hidden="true">📍</span>
        <span className="font-medium">Matched on {anchor.track.title}</span>
      </div>
      <div>
        <button
          type="button"
          onClick={() => void play(anchor.myPost.isrc, anchor.myPost.momentStartMs)}
          disabled={status === 'loading'}
          className="text-xs text-muted transition-opacity hover:text-accent hover:underline disabled:opacity-50"
        >
          {status === 'loading'
            ? '…'
            : `▶ ${formatMoment(anchor.myPost.momentStartMs, anchor.myPost.momentEndMs)}`}
        </button>
        <span className="text-xs text-muted">
          {' · '}
          {anchor.matchTier === 0 ? 'Exact resonance' : 'Same moment, different lens'}
        </span>
        {status === 'error' && message && (
          <p className="mt-1 text-xs text-muted">{message}</p>
        )}
      </div>
      <div className="flex gap-3 text-xs">
        <div className="flex-1 space-y-0.5">
          <p className="text-muted/60">You</p>
          <p className="font-medium">
            {FOCUS_TYPE_LABELS[anchor.myPost.focusType]}
            {anchor.myPost.subLayer && ` · ${anchor.myPost.subLayer}`}
          </p>
        </div>
        <div className="flex-1 space-y-0.5">
          <p className="text-muted/60">Them</p>
          <p className="font-medium">
            {FOCUS_TYPE_LABELS[anchor.theirPost.focusType]}
            {anchor.theirPost.subLayer && ` · ${anchor.theirPost.subLayer}`}
          </p>
        </div>
      </div>
    </div>
  )
}
