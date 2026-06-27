// apps/web/src/components/TrackCard.tsx
'use client'

import { formatTime } from '@/lib/format'

export function TrackCard({
  title,
  artist,
  albumArt,
  progressMs,
  durationMs,
  subtitle,
}: {
  title: string
  artist: string
  albumArt: string | null
  progressMs?: number
  durationMs?: number
  subtitle?: string
}) {
  const showBar =
    typeof progressMs === 'number' && typeof durationMs === 'number' && durationMs > 0
  const pct = showBar ? Math.min(100, (progressMs / durationMs) * 100) : 0

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-4">
        {albumArt && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={albumArt} alt="" width={64} height={64} className="rounded-lg" />
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold">{title}</div>
          <div className="truncate text-sm text-muted">{artist}</div>
          {subtitle && <div className="mt-1 text-xs text-muted">{subtitle}</div>}
        </div>
      </div>

      {showBar && (
        <div className="mt-3">
          <div className="h-1 w-full overflow-hidden rounded-full bg-border">
            <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
          </div>
          <div className="mt-1 flex justify-between text-xs tabular-nums text-muted">
            <span>{formatTime(progressMs)}</span>
            <span>{formatTime(durationMs)}</span>
          </div>
        </div>
      )}
    </div>
  )
}
