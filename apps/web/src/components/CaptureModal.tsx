// apps/web/src/components/CaptureModal.tsx
'use client'

import { useState, useEffect } from 'react'
import type {
  CreatePostResponse,
  FocusType,
  LrcLine,
  TrackSummary,
} from '@resonance/shared'
import { formatTime } from '@/lib/format'
import { FocusTypePicker } from './FocusTypePicker'
import { SubLayerPicker } from './SubLayerPicker'
import { LyricRangePreview } from './LyricRangePreview'
import { SensoryTagSelector } from './SensoryTagSelector'
import { MatchResponse } from './MatchResponse'

export interface PendingCapture {
  startMs: number
  endMs: number | null
  lyricText?: string | null      // pre-filled from lyrics tap selection
  preselectedLayer?: FocusType   // 'lyrics' when from lyrics capture
}

interface Props {
  track: TrackSummary
  pending: PendingCapture
  lrcLines: LrcLine[] | null
  onSave: (result: CreatePostResponse) => void
  onDismiss: () => void
}

export function CaptureModal({ track, pending, lrcLines, onSave, onDismiss }: Props) {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(id)
  }, [])

  // Pre-fill from pending if coming from lyrics selection
  const [focusType, setFocusType] = useState<FocusType | null>(
    pending.preselectedLayer ?? null,
  )
  const [subLayer, setSubLayer] = useState<string | null>(null)
  const [lyricText, setLyricText] = useState<string | null>(
    pending.lyricText ?? null,
  )
  const [tags, setTags] = useState<string[]>([])
  const [reflection, setReflection] = useState('')

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<CreatePostResponse | null>(null)

  useEffect(() => { setSubLayer(null) }, [focusType])

  const momentLabel = pending.endMs
    ? `${formatTime(pending.startMs)} → ${formatTime(pending.endMs)}`
    : `@ ${formatTime(pending.startMs)}`

  const isFromLyrics = !!pending.preselectedLayer && !!pending.lyricText

  async function handleSave() {
    if (!focusType) return
    setSaving(true)
    setError(null)

    const res = await fetch('/api/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        track,
        momentStartMs: pending.startMs,
        momentEndMs: pending.endMs ?? null,
        focusType,
        subLayer: subLayer ?? null,
        sensoryTags: tags,
        lyricText: lyricText ?? null,
        reflection: reflection.trim() || undefined,
      }),
    })

    setSaving(false)

    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      setError(data.error ?? 'Could not save. Please try again.')
      return
    }

    const data = (await res.json()) as CreatePostResponse
    setResult(data)
    onSave(data)
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onDismiss}
        className={[
          'fixed inset-0 z-40 bg-black/50 transition-opacity duration-300',
          visible ? 'opacity-100' : 'opacity-0',
        ].join(' ')}
      />

      {/* Sheet */}
      <div
        className={[
          'fixed bottom-0 left-0 right-0 z-50 mx-auto max-w-md',
          'rounded-t-2xl bg-background shadow-2xl',
          'transition-transform duration-300 ease-out',
          visible ? 'translate-y-0' : 'translate-y-full',
        ].join(' ')}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-border" />
        </div>

        <div className="max-h-[78vh] overflow-y-auto px-5 pb-8 pt-2">

          {/* Result state */}
          {result && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold">Moment saved</h2>
                <button type="button" onClick={onDismiss} className="text-sm text-accent hover:underline">
                  Done
                </button>
              </div>
              <MatchResponse result={result} />
            </div>
          )}

          {/* Capture form */}
          {!result && (
            <div className="space-y-5">
              {/* Header */}
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{track.title}</p>
                    <p className="truncate text-xs text-muted">{track.artist}</p>
                  </div>
                  <button type="button" onClick={onDismiss} className="shrink-0 text-xs text-muted hover:text-foreground">
                    ✕
                  </button>
                </div>
                <p className="mt-1.5 text-sm font-medium text-accent">{momentLabel}</p>

                {/* Captured lyric preview */}
                {isFromLyrics && (
                  <p className="mt-2 rounded-lg bg-accent/10 px-3 py-2 text-sm italic text-foreground/80">
                    "{pending.lyricText}"
                  </p>
                )}
              </div>

              {/* Layer selection */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">What are you noticing?</p>
                  {isFromLyrics && (
                    <span className="text-xs text-accent">Lyrics pre-selected</span>
                  )}
                </div>
                <FocusTypePicker selected={focusType} onSelect={setFocusType} />
              </div>

              {/* Sub-layer */}
              {focusType && (
                <SubLayerPicker focusType={focusType} value={subLayer} onChange={setSubLayer} />
              )}

              {/* Lyric range preview — only when lyrics layer + NOT from lyrics tap */}
              {focusType === 'lyrics' && !isFromLyrics && (
                <LyricRangePreview
                  lines={lrcLines}
                  startMs={pending.startMs}
                  endMs={pending.endMs}
                  onTextChange={setLyricText}
                />
              )}

              {/* Sensory tags */}
              {focusType && <SensoryTagSelector selected={tags} onChange={setTags} />}

              {/* Reflection */}
              {focusType && (
                <div className="space-y-1.5">
                  <label htmlFor="reflection" className="text-sm font-medium">
                    Reflection <span className="font-normal text-muted">(optional)</span>
                  </label>
                  <textarea
                    id="reflection"
                    value={reflection}
                    onChange={(e) => setReflection(e.target.value)}
                    rows={3}
                    placeholder="What are you noticing?"
                    className="w-full resize-none rounded-xl border border-border bg-card p-3 text-sm outline-none focus:border-accent"
                  />
                </div>
              )}

              {error && <p className="text-sm text-red-500">{error}</p>}

              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={!focusType || saving}
                className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-accent px-6 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                {saving ? 'Saving…' : 'Save moment'}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
