// apps/web/src/components/LyricRangePreview.tsx
//
// Shown inside CaptureModal when focusType = 'lyrics'.
// Filters synced lines to those within the captured range,
// lets the user deselect any line, and reports the joined text.
// Falls back to an optional free-text input when no lines exist.

'use client'

import { useState, useEffect } from 'react'
import type { LrcLine } from '@resonance/shared'

interface Props {
  lines: LrcLine[] | null       // all synced lines for the track (null = unavailable)
  startMs: number
  endMs: number | null          // null = point capture, use startMs ± buffer
  onTextChange: (text: string | null) => void
}

// Buffer around point captures and range edges to catch nearby lines
const EDGE_BUFFER_MS = 500

export function LyricRangePreview({ lines, startMs, endMs, onTextChange }: Props) {
  const [manualText, setManualText] = useState('')
  const [deselected, setDeselected] = useState<Set<number>>(new Set())

  // Determine the effective range to search within
  const rangeStart = startMs - EDGE_BUFFER_MS
  const rangeEnd = (endMs ?? startMs) + EDGE_BUFFER_MS

  // Filter lines that fall within the range
  const matchedLines = lines
    ? lines.filter((l) => l.timestampMs >= rangeStart && l.timestampMs <= rangeEnd)
    : []

  // Reset deselected when range changes
  useEffect(() => {
    setDeselected(new Set())
  }, [startMs, endMs])

  // Report combined text up whenever selection changes
  useEffect(() => {
    if (matchedLines.length === 0) {
      // No matched lines — report manual text or null
      onTextChange(manualText.trim() || null)
      return
    }
    const selectedLines = matchedLines.filter((_, i) => !deselected.has(i))
    const combined = selectedLines.map((l) => l.text).join(' / ')
    onTextChange(combined || null)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deselected, manualText, matchedLines.length])

  function toggleLine(index: number) {
    setDeselected((prev) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  // No synced lyrics available for this track
  if (!lines || lines.length === 0) {
    return (
      <div className="space-y-2">
        <p className="text-xs text-muted">
          No synced lyrics found.{' '}
          <span className="text-foreground">Type the lyric</span>{' '}
          <span className="text-muted">(optional)</span>
        </p>
        <textarea
          value={manualText}
          onChange={(e) => setManualText(e.target.value)}
          rows={2}
          placeholder="e.g. sit down, be humble"
          className="w-full resize-none rounded-xl border border-border bg-card p-3 text-sm outline-none focus:border-accent"
        />
      </div>
    )
  }

  // Lines exist but none fall in the captured range
  if (matchedLines.length === 0) {
    return (
      <div className="space-y-2">
        <p className="text-xs text-muted">
          No lyrics in this range.{' '}
          <span className="text-foreground">Type one</span>{' '}
          <span className="text-muted">(optional)</span>
        </p>
        <textarea
          value={manualText}
          onChange={(e) => setManualText(e.target.value)}
          rows={2}
          placeholder="e.g. sit down, be humble"
          className="w-full resize-none rounded-xl border border-border bg-card p-3 text-sm outline-none focus:border-accent"
        />
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted">Captured lyrics · tap to deselect</p>
      <div className="flex flex-wrap gap-2">
        {matchedLines.map((line, i) => {
          const selected = !deselected.has(i)
          return (
            <button
              key={i}
              type="button"
              onClick={() => toggleLine(i)}
              className={[
                'rounded-xl border px-3 py-1.5 text-sm transition-colors',
                selected
                  ? 'border-accent bg-accent/10 text-foreground'
                  : 'border-border bg-card text-muted line-through',
              ].join(' ')}
            >
              {line.text}
            </button>
          )
        })}
      </div>
    </div>
  )
}
