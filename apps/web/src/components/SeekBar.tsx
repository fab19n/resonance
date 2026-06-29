// apps/web/src/components/SeekBar.tsx
//
// Minimal seek slider — only shown when no synced lyrics are available.
// When lyrics exist, scroll-to-seek covers this need instead.
// Drag thumb or tap anywhere on the track to seek.

'use client'

import { useRef } from 'react'
import { formatTime } from '@/lib/format'

interface Props {
  progressMs: number
  durationMs: number
  onSeek: (ms: number) => void
}

export function SeekBar({ progressMs, durationMs, onSeek }: Props) {
  const trackRef = useRef<HTMLDivElement>(null)

  function msFromClientX(clientX: number): number {
    const rect = trackRef.current?.getBoundingClientRect()
    if (!rect || durationMs <= 0) return 0
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    return Math.round(pct * durationMs)
  }

  function handlePointerDown(e: React.PointerEvent) {
    e.currentTarget.setPointerCapture(e.pointerId)
    onSeek(msFromClientX(e.clientX))
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (e.buttons === 0) return
    onSeek(msFromClientX(e.clientX))
  }

  const progressPct = durationMs > 0 ? (progressMs / durationMs) * 100 : 0

  return (
    <div className="space-y-1.5">
      {/* Track + thumb */}
      <div
        ref={trackRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        style={{ touchAction: 'none' }}
        className="relative flex h-8 cursor-pointer items-center"
        aria-label="Seek"
      >
        {/* Track background */}
        <div className="absolute inset-x-0 h-1 rounded-full bg-border" />

        {/* Filled portion */}
        <div
          className="absolute h-1 rounded-full bg-accent/50"
          style={{ width: `${progressPct}%` }}
        />

        {/* Thumb */}
        <div
          className="absolute h-3.5 w-3.5 -translate-x-1/2 rounded-full bg-accent shadow"
          style={{ left: `${progressPct}%` }}
        />
      </div>

      {/* Time labels */}
      <div className="flex justify-between text-xs tabular-nums text-muted/60">
        <span>{formatTime(progressMs)}</span>
        <span>{formatTime(durationMs)}</span>
      </div>
    </div>
  )
}