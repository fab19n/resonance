// apps/web/src/components/SyncedLyricsDisplay.tsx

'use client'

import { useRef, useState, useEffect, useMemo } from 'react'
import type { LrcLine } from '@resonance/shared'

const LINE_HEIGHT = 44
const CONTAINER_HEIGHT = 220
const SCROLL_DEBOUNCE = 300
const RESUME_DELAY = 1500
const MAX_SELECTED = 6

interface Props {
  lines: LrcLine[]
  progressMs: number
  durationMs: number          // full track duration for proportional seek
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
  const programmaticTimer = useRef<ReturnType<typeof setTimeout>>()
  const scrollDebounce = useRef<ReturnType<typeof setTimeout>>()
  const resumeTimer = useRef<ReturnType<typeof setTimeout>>()

  // Multi-select: up to MAX_SELECTED individual lines (non-contiguous)
  const [selectedIndices, setSelectedIndices] = useState<number[]>([])

  // Active line from playback position
  const activeIndex = useMemo(() => {
    let idx = 0
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].timestampMs <= progressMs) idx = i
      else break
    }
    return idx
  }, [lines, progressMs])

  // ── Auto-scroll ───────────────────────────────────────────────────────────
  // scrollTop = activeIndex * LINE_HEIGHT centres line i in the viewport
  // (proof: padding_top = CONTAINER_HEIGHT/2 - LINE_HEIGHT/2, so centre of
  //  line i = CONTAINER_HEIGHT/2 + i*LINE_HEIGHT, viewport centre = scrollTop +
  //  CONTAINER_HEIGHT/2, solve → scrollTop = i * LINE_HEIGHT)

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

  // ── Scroll → seek ─────────────────────────────────────────────────────────
  // Maps scroll position proportionally to the full track duration so:
  //   scrollTop = 0           → seekMs = 0   (track start, regardless of first lyric)
  //   scrollTop = maxScrollTop → seekMs = durationMs (track end)

  function handleScroll() {
    if (isProgrammaticScroll.current) return

    isUserScrolling.current = true
    clearTimeout(scrollDebounce.current)
    scrollDebounce.current = setTimeout(() => {
      const container = containerRef.current
      if (!container || durationMs <= 0) return

      // maxScrollTop = (lines.length - 1) * LINE_HEIGHT
      // (the scroll range that moves from first line centred to last line centred)
      const maxScrollTop = Math.max(1, (lines.length - 1) * LINE_HEIGHT)
      const ratio = Math.min(1, Math.max(0, container.scrollTop / maxScrollTop))
      const seekMs = Math.round(ratio * durationMs)

      onSeek(seekMs)

      clearTimeout(resumeTimer.current)
      resumeTimer.current = setTimeout(() => {
        isUserScrolling.current = false
      }, RESUME_DELAY)
    }, SCROLL_DEBOUNCE)
  }

  // ── Line tap → multi-select ───────────────────────────────────────────────

  function handleLineTap(index: number) {
    setSelectedIndices((prev) => {
      if (prev.includes(index)) {
        return prev.filter((i) => i !== index)
      }
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
    const startMs = lines[sorted[0]].timestampMs
    const endMs = lines[sorted[sorted.length - 1]].timestampMs
    const lyricText = sorted.map((i) => lines[i].text).filter(Boolean).join(' / ')
    clearSelection()
    onLyricsCapture(startMs, endMs, lyricText)
  }

  // ── Render ────────────────────────────────────────────────────────────────

  function lineClasses(index: number): string {
    const isActive = index === activeIndex
    const isSelected = selectedIndices.includes(index)
    const distance = Math.abs(index - activeIndex)

    if (isSelected) return 'text-foreground font-medium bg-accent/15 rounded-lg'
    if (isActive) return 'text-foreground font-semibold'
    if (distance <= 1) return 'text-foreground/65'
    if (distance <= 3) return 'text-muted/50'
    return 'text-muted/25'
  }

  return (
    <div className="space-y-1">
      {/* Scrollable lyrics list — thin custom scrollbar */}
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
          // Webkit thin scrollbar
          '[&::-webkit-scrollbar]:w-1',
          '[&::-webkit-scrollbar-track]:bg-transparent',
          '[&::-webkit-scrollbar-thumb]:rounded-full',
          '[&::-webkit-scrollbar-thumb]:bg-border',
        ].join(' ')}
      >
        {/* Top padding: first line centred at scrollTop=0 */}
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
            <span className="w-full truncate text-center">
              {line.text || '♩'}
            </span>
          </div>
        ))}

        {/* Bottom padding: last line centred at max scrollTop */}
        <div style={{ height: CONTAINER_HEIGHT / 2 - LINE_HEIGHT / 2 }} />
      </div>

      {/* Selection counter + hint */}
      {selectedIndices.length > 0 && (
        <p className="text-center text-xs text-muted/60">
          {selectedIndices.length} line{selectedIndices.length > 1 ? 's' : ''} selected
          {selectedIndices.length < MAX_SELECTED ? ` · tap more to add` : ' · max reached'}
        </p>
      )}

      {/* Capture strip */}
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

      {/* Scroll hint when idle */}
      {selectedIndices.length === 0 && (
        <p className="text-center text-xs text-muted/35">
          Scroll to seek · tap lines to capture
        </p>
      )}
    </div>
  )
}