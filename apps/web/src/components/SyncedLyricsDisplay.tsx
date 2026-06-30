// apps/web/src/components/SyncedLyricsDisplay.tsx
//
// Interactive lyrics display:
//   - Auto-scrolls to keep active line centred during playback
//   - onScroll (debounced 300ms) → seek, mapped proportionally to durationMs
//   - While dragging: live highlight follows the scroll target (not the
//     playback position), and a time badge tracks alongside the scrollbar —
//     same pattern as iOS Contacts' fast-scroll index bubble. Both vanish
//     the instant the drag settles.
//   - onClick on each line → multi-select up to 6 lines for capture

'use client'

import { useRef, useState, useEffect, useMemo } from 'react'
import type { LrcLine } from '@resonance/shared'
import { formatTime } from '@/lib/format'

const LINE_HEIGHT = 44
const CONTAINER_HEIGHT = 220
const SCROLL_DEBOUNCE = 300
const RESUME_DELAY = 1500
const MAX_SELECTED = 6

interface Props {
  lines: LrcLine[]
  progressMs: number
  durationMs: number
  onSeek: (ms: number) => void
  onLyricsCapture: (startMs: number, endMs: number, lyricText: string) => void
}

export function SyncedLyricsDisplay({
  lines,
  progressMs,
  durationMs,
  onSeek,
  onLyricsCapture,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)

  const isUserScrolling = useRef(false)
  const isProgrammaticScroll = useRef(false)
  const programmaticTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const scrollDebounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const [selectedIndices, setSelectedIndices] = useState<number[]>([])

  // Live drag feedback — updates immediately on every scroll event, separate
  // from the debounced seek action, so the highlight + badge feel instant.
  const [isDragging, setIsDragging] = useState(false)
  const [dragTargetIndex, setDragTargetIndex] = useState<number | null>(null)
  const [scrollRatio, setScrollRatio] = useState(0) // 0..1, badge position along the scrollbar

  // .entries() rather than a classic index loop — under noUncheckedIndexedAccess,
  // lines[i] types as LrcLine | undefined, but destructuring from .entries()
  // gives `line` as a real LrcLine with no indexing involved at all.
  const activeIndex = useMemo(() => {
    let idx = 0
    for (const [i, line] of lines.entries()) {
      if (line.timestampMs <= progressMs) idx = i
      else break
    }
    return idx
  }, [lines, progressMs])

  // scrollTop = activeIndex * LINE_HEIGHT centres line i in the viewport
  // (padding_top = CONTAINER_HEIGHT/2 - LINE_HEIGHT/2, so centre of line i =
  //  CONTAINER_HEIGHT/2 + i*LINE_HEIGHT; viewport centre = scrollTop +
  //  CONTAINER_HEIGHT/2; solving for scrollTop gives i * LINE_HEIGHT)
  useEffect(() => {
    if (isUserScrolling.current) return
    const container = containerRef.current
    if (!container) return
    isProgrammaticScroll.current = true
    clearTimeout(programmaticTimer.current)
    container.scrollTo({ top: Math.max(0, activeIndex * LINE_HEIGHT), behavior: 'smooth' })
    programmaticTimer.current = setTimeout(() => {
      isProgrammaticScroll.current = false
    }, 600)
  }, [activeIndex])

  function handleScroll() {
    if (isProgrammaticScroll.current) return

    isUserScrolling.current = true
    setIsDragging(true)

    const container = containerRef.current
    if (container) {
      const maxScrollTop = Math.max(1, (lines.length - 1) * LINE_HEIGHT)
      const centeredIndex = Math.min(
        Math.max(0, Math.round(container.scrollTop / LINE_HEIGHT)),
        lines.length - 1,
      )
      setDragTargetIndex(centeredIndex)
      setScrollRatio(Math.min(1, Math.max(0, container.scrollTop / maxScrollTop)))
    }

    clearTimeout(scrollDebounce.current)
    scrollDebounce.current = setTimeout(() => {
      const c = containerRef.current
      if (!c || durationMs <= 0) return

      // Proportional to the full track duration — scrolling all the way up
      // always seeks to 0:00 regardless of where the first lyric sits, and
      // all the way down always reaches the true end of the track.
      const maxScrollTop = Math.max(1, (lines.length - 1) * LINE_HEIGHT)
      const ratio = Math.min(1, Math.max(0, c.scrollTop / maxScrollTop))
      onSeek(Math.round(ratio * durationMs))

      setIsDragging(false)
      setDragTargetIndex(null)

      clearTimeout(resumeTimer.current)
      resumeTimer.current = setTimeout(() => {
        isUserScrolling.current = false
      }, RESUME_DELAY)
    }, SCROLL_DEBOUNCE)
  }

  function handleLineTap(index: number) {
    setSelectedIndices((prev) => {
      if (prev.includes(index)) return prev.filter((i) => i !== index)
      if (prev.length >= MAX_SELECTED) return prev
      return [...prev, index]
    })
  }

  function clearSelection() {
    setSelectedIndices([])
  }

  function handleCapture() {
    if (selectedIndices.length === 0) return
    const sorted = [...selectedIndices].sort((a, b) => a - b)
    // Non-null: sorted is derived from selectedIndices, which only ever holds
    // valid indices into `lines` (set via handleLineTap(i) in the map below),
    // and the length check above guarantees sorted is non-empty.
    const startMs = lines[sorted[0]!]!.timestampMs
    const endMs = lines[sorted[sorted.length - 1]!]!.timestampMs
    const lyricText = sorted.map((i) => lines[i]!.text).filter(Boolean).join(' / ')
    clearSelection()
    onLyricsCapture(startMs, endMs, lyricText)
  }

  function lineClasses(index: number): string {
    const isActive = index === activeIndex
    const isSelected = selectedIndices.includes(index)
    const isDragTarget = isDragging && index === dragTargetIndex

    // While dragging, fade out from the drag target instead of the playback
    // position — the visible lines "open up" naturally around wherever
    // you're scrubbing, giving an immediate sense of where you'd land.
    const referenceIndex = isDragging && dragTargetIndex !== null ? dragTargetIndex : activeIndex
    const distance = Math.abs(index - referenceIndex)

    if (isDragTarget) return 'text-foreground font-semibold bg-accent/12 rounded-lg ring-1 ring-accent/40'
    if (isSelected) return 'text-foreground font-medium bg-accent/15 rounded-lg'
    if (isActive && !isDragging) return 'text-foreground font-semibold'
    if (distance <= 1) return 'text-foreground/65'
    if (distance <= 3) return 'text-muted/50'
    return 'text-muted/25'
  }

  return (
    <div className="relative space-y-1">
      <div
        ref={containerRef}
        onScroll={handleScroll}
        style={{
          height: CONTAINER_HEIGHT,
          scrollbarWidth: 'thin',
          scrollbarColor: 'var(--color-border) transparent',
        }}
        className={[
          'overflow-y-auto overscroll-contain',
          '[&::-webkit-scrollbar]:w-1',
          '[&::-webkit-scrollbar-track]:bg-transparent',
          '[&::-webkit-scrollbar-thumb]:rounded-full',
          '[&::-webkit-scrollbar-thumb]:bg-border',
        ].join(' ')}
      >
        <div style={{ height: CONTAINER_HEIGHT / 2 - LINE_HEIGHT / 2 }} />
        {lines.map((line, i) => (
          <div
            key={i}
            onClick={() => handleLineTap(i)}
            style={{ height: LINE_HEIGHT }}
            className={[
              'flex cursor-pointer select-none items-center px-3',
              'text-sm leading-none transition-all duration-200',
              lineClasses(i),
            ].join(' ')}
          >
            <span className="w-full truncate text-center">{line.text || '♩'}</span>
          </div>
        ))}
        <div style={{ height: CONTAINER_HEIGHT / 2 - LINE_HEIGHT / 2 }} />
      </div>

      {/* Time badge — tracks alongside the scrollbar, only while dragging.
          Non-null: dragTargetIndex is always set from a value clamped into
          [0, lines.length - 1] in handleScroll, so the lookup is guaranteed
          in-bounds even though TS can't prove that itself. */}
      {isDragging && dragTargetIndex !== null && (
        <div
          className="pointer-events-none absolute right-2 -translate-y-1/2 rounded-full bg-accent px-2 py-1 text-[11px] font-medium tabular-nums text-accent-foreground shadow"
          style={{ top: `${scrollRatio * 100}%` }}
        >
          {formatTime(lines[dragTargetIndex]!.timestampMs)}
        </div>
      )}

      {selectedIndices.length > 0 && (
        <p className="text-center text-xs text-muted/60">
          {selectedIndices.length} line{selectedIndices.length > 1 ? 's' : ''} selected
          {selectedIndices.length < MAX_SELECTED ? ` · tap more to add` : ' · max reached'}
        </p>
      )}

      {selectedIndices.length > 0 && (
        <div className="flex items-center gap-2 pt-0.5">
          <button
            type="button"
            onClick={clearSelection}
            className="shrink-0 rounded-full border border-border px-3 py-2 text-xs text-muted hover:text-foreground"
          >
            ✕
          </button>
          <button
            type="button"
            onClick={handleCapture}
            className="flex-1 rounded-full bg-accent py-2.5 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90"
          >
            Capture Lyrics →
          </button>
        </div>
      )}

      {selectedIndices.length === 0 && !isDragging && (
        <p className="text-center text-xs text-muted/35">Scroll to seek · tap lines to capture</p>
      )}
    </div>
  )
}