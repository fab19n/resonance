// apps/web/src/components/WaveformBar.tsx
//
// Always a capture surface — tap = point capture, drag = range capture.
// Never seeks. Seeking is handled by:
//   - lyrics scroll (when lyrics available)
//   - SeekBar component (when no lyrics)
//
// Visual: seeded bar heights from ISRC, moving playhead, selection fill.

'use client'

import { useRef, useState } from 'react'
import { formatTime } from '@/lib/format'

function seededRandom(seed: string) {
  let h = 0
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0
  }
  return () => {
    h ^= h << 13
    h ^= h >> 17
    h ^= h << 5
    return (h >>> 0) / 0xffffffff
  }
}

function generateBars(seed: string, count = 100): number[] {
  const rand = seededRandom(seed)
  const raw = Array.from({ length: count }, () => rand())
  return raw.map((_, i) => {
    const slice = raw.slice(Math.max(0, i - 2), i + 3)
    const avg = slice.reduce((a, b) => a + b, 0) / slice.length
    return 0.12 + avg * 0.88
  })
}

interface Props {
  seed: string
  durationMs: number
  progressMs: number
  onCapturePoint: (ms: number) => void
  onCaptureRange: (startMs: number, endMs: number) => void
}

const DRAG_THRESHOLD = 6

export function WaveformBar({
  seed,
  durationMs,
  progressMs,
  onCapturePoint,
  onCaptureRange,
}: Props) {
  const trackRef = useRef<HTMLDivElement>(null)
  const bars = useRef(generateBars(seed)).current
  const pointerDownX = useRef(0)
  const pointerDownMs = useRef(0)
  const isDraggingRef = useRef(false)

  const [activeDrag, setActiveDrag] = useState<{ startMs: number; endMs: number } | null>(null)
  const [committedRange, setCommittedRange] = useState<{ startMs: number; endMs: number } | null>(null)

  function msFromClientX(clientX: number): number {
    const rect = trackRef.current?.getBoundingClientRect()
    if (!rect || durationMs <= 0) return 0
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    return Math.round(pct * durationMs)
  }

  function handlePointerDown(e: React.PointerEvent) {
    e.currentTarget.setPointerCapture(e.pointerId)
    pointerDownX.current = e.clientX
    pointerDownMs.current = msFromClientX(e.clientX)
    isDraggingRef.current = false
    setCommittedRange(null)
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (e.buttons === 0) return
    const movedPx = Math.abs(e.clientX - pointerDownX.current)
    if (!isDraggingRef.current && movedPx > DRAG_THRESHOLD) {
      isDraggingRef.current = true
    }
    if (isDraggingRef.current) {
      const currentMs = msFromClientX(e.clientX)
      setActiveDrag({
        startMs: Math.min(pointerDownMs.current, currentMs),
        endMs: Math.max(pointerDownMs.current, currentMs),
      })
    }
  }

  function handlePointerUp(e: React.PointerEvent) {
    const upMs = msFromClientX(e.clientX)
    const movedPx = Math.abs(e.clientX - pointerDownX.current)
    const wasDrag = isDraggingRef.current && movedPx > DRAG_THRESHOLD

    if (!wasDrag) {
      setActiveDrag(null)
      onCapturePoint(pointerDownMs.current)
    } else {
      const startMs = Math.min(pointerDownMs.current, upMs)
      const endMs = Math.max(pointerDownMs.current, upMs)
      setActiveDrag(null)
      setCommittedRange({ startMs, endMs })
    }

    isDraggingRef.current = false
  }

  function confirmCapture() {
    if (!committedRange) return
    setCommittedRange(null)
    onCaptureRange(committedRange.startMs, committedRange.endMs)
  }

  const playheadPct = durationMs > 0 ? (progressMs / durationMs) * 100 : 0
  const displayRange = activeDrag ?? committedRange

  return (
    <div className="space-y-1.5">
      <p className="text-xs text-muted/50">
        {committedRange ? 'Confirm range or' : 'Tap or drag to capture ·'}{' '}
        {!committedRange && <span className="text-muted/35">waveform</span>}
      </p>

      {/* Waveform */}
      <div
        ref={trackRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        style={{ touchAction: 'none' }}
        className="relative h-16 cursor-pointer overflow-hidden rounded-xl border border-border bg-card px-1"
        aria-label="Capture range"
      >
        {/* Bars */}
        <div className="flex h-full items-end gap-px pb-0.5">
          {bars.map((height, i) => {
            const barPct = (i / bars.length) * 100
            const isBeforePlayhead = barPct <= playheadPct
            const isInRange =
              displayRange &&
              barPct >= (displayRange.startMs / durationMs) * 100 &&
              barPct <= (displayRange.endMs / durationMs) * 100

            return (
              <div
                key={i}
                className={[
                  'flex-1 rounded-sm',
                  isInRange
                    ? 'bg-accent/70'
                    : isBeforePlayhead
                      ? 'bg-muted/60'
                      : 'bg-muted/25',
                ].join(' ')}
                style={{ height: `${height * 100}%` }}
              />
            )
          })}
        </div>

        {/* Playhead */}
        <div
          className="pointer-events-none absolute inset-y-0 w-0.5 rounded-full bg-accent shadow"
          style={{ left: `${playheadPct}%` }}
        />

        {/* Range overlay */}
        {displayRange && (
          <div
            className="pointer-events-none absolute inset-y-0 rounded bg-accent/20 ring-1 ring-accent/40"
            style={{
              left: `${(displayRange.startMs / durationMs) * 100}%`,
              width: `${((displayRange.endMs - displayRange.startMs) / durationMs) * 100}%`,
            }}
          />
        )}
      </div>

      {/* Time labels */}
      <div className="flex items-center justify-between px-0.5 text-xs tabular-nums text-muted">
        <span>{formatTime(progressMs)}</span>
        {displayRange && (
          <span className="font-medium text-accent">
            {formatTime(displayRange.startMs)} → {formatTime(displayRange.endMs)}
          </span>
        )}
        <span>{formatTime(durationMs)}</span>
      </div>

      {/* Confirm range */}
      {committedRange && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCommittedRange(null)}
            className="text-xs text-muted hover:text-foreground"
          >
            ✕ Clear
          </button>
          <button
            type="button"
            onClick={confirmCapture}
            className="flex-1 rounded-full bg-accent py-2.5 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90"
          >
            Capture this moment →
          </button>
        </div>
      )}
    </div>
  )
}