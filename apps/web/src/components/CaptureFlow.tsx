// apps/web/src/components/CaptureFlow.tsx
'use client'

import { useEffect, useState } from 'react'
import type {
  CreatePostResponse,
  FocusType,
  SearchResponse,
  TrackSummary,
} from '@resonance/shared'
import { useNowPlaying } from '@/lib/useNowPlaying'
import { formatTime } from '@/lib/format'
import { FocusTypePicker } from './FocusTypePicker'
import { SensoryTagSelector } from './SensoryTagSelector'
import { TrackCard } from './TrackCard'
import { MatchResponse } from './MatchResponse'

const FIRST_CAPTURE_KEY = 'resonance_first_capture_done'

interface FrozenMoment {
  track: TrackSummary
  progressMs: number
}

export function CaptureFlow() {
  const np = useNowPlaying()

  const [focusType, setFocusType] = useState<FocusType | null>(null)
  const [tags, setTags] = useState<string[]>([])
  const [reflection, setReflection] = useState('')
  const [frozen, setFrozen] = useState<FrozenMoment | null>(null)

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<CreatePostResponse | null>(null)

  // Search fallback (when nothing is playing). A search-selected track has no
  // live position, so its moment is fixed at 0.
  const [searchTrack, setSearchTrack] = useState<TrackSummary | null>(null)
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState<TrackSummary[]>([])
  const [searching, setSearching] = useState(false)

  const [isFirst, setIsFirst] = useState(false)
  useEffect(() => {
    setIsFirst(!localStorage.getItem(FIRST_CAPTURE_KEY))
  }, [])

  const targetTrack = searchTrack ?? np.track

  function selectFocus(focus: FocusType) {
    // Freeze the moment on the FIRST focus tap (the reaction instant), so the
    // position can't drift while tags/reflection are added.
    if (!frozen && targetTrack) {
      setFrozen({
        track: targetTrack,
        progressMs: searchTrack ? 0 : np.getProgressMs(),
      })
    }
    setFocusType(focus)
  }

  function recapture() {
    if (!targetTrack) return
    setFrozen({
      track: targetTrack,
      progressMs: searchTrack ? 0 : np.getProgressMs(),
    })
  }

  async function runSearch() {
    if (!query.trim()) return
    setSearching(true)
    const res = await fetch(`/api/spotify/search?q=${encodeURIComponent(query.trim())}`)
    const data: SearchResponse = res.ok ? await res.json() : { tracks: [] }
    setSearchResults(data.tracks)
    setSearching(false)
  }

  async function save() {
    if (!frozen || !focusType) return
    setSaving(true)
    setError(null)
    const res = await fetch('/api/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        track: frozen.track,
        progressMs: frozen.progressMs,
        focusType,
        sensoryTags: tags,
        reflection: reflection.trim() || undefined,
      }),
    })
    setSaving(false)
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      setError(data.error ?? 'Could not save your moment. Please try again.')
      return
    }
    const data = (await res.json()) as CreatePostResponse
    localStorage.setItem(FIRST_CAPTURE_KEY, '1')
    setIsFirst(false)
    setResult(data)
  }

  function captureAnother() {
    setFocusType(null)
    setTags([])
    setReflection('')
    setFrozen(null)
    setSearchTrack(null)
    setResult(null)
    void np.refresh()
  }

  // ── Result ────────────────────────────────────────────────────────────────
  if (result) {
    return (
      <div className="space-y-6">
        <MatchResponse result={result} />
        <div className="flex gap-3">
          <button
            type="button"
            onClick={captureAnother}
            className="inline-flex min-h-12 flex-1 items-center justify-center rounded-full bg-accent px-5 font-medium text-accent-foreground transition-opacity hover:opacity-90"
          >
            Capture another
          </button>
          <a
            href="/resonances"
            className="inline-flex min-h-12 flex-1 items-center justify-center rounded-full border border-border px-5 font-medium transition-colors hover:border-accent"
          >
            My Resonances
          </a>
        </div>
      </div>
    )
  }

  // ── Loading ─────────────────────────────────────────────────────────────--
  if (np.status === 'loading') {
    return <p className="text-muted">Detecting what you're listening to…</p>
  }

  // ── Nothing playing → search fallback ──────────────────────────────────────
  if (!targetTrack) {
    return (
      <div className="space-y-4">
        <p className="text-muted">Nothing playing. Find a song you've been listening to.</p>
        <div className="flex gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void runSearch()
            }}
            placeholder="Search Spotify…"
            className="min-h-12 flex-1 rounded-xl border border-border bg-card px-4 outline-none focus:border-accent"
          />
          <button
            type="button"
            onClick={() => void runSearch()}
            disabled={searching}
            className="min-h-12 rounded-xl bg-accent px-5 font-medium text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {searching ? '…' : 'Search'}
          </button>
        </div>
        <div className="space-y-2">
          {searchResults.map((t) => (
            <button
              key={t.spotifyTrackId}
              type="button"
              onClick={() => {
                setSearchTrack(t)
                setSearchResults([])
                setQuery('')
              }}
              className="block w-full rounded-xl border border-border bg-card p-3 text-left transition-colors hover:border-accent"
            >
              <div className="truncate text-sm font-medium">{t.title}</div>
              <div className="truncate text-xs text-muted">{t.artist}</div>
            </button>
          ))}
        </div>
      </div>
    )
  }

  // ── Capture ────────────────────────────────────────────────────────────────
  const isLive = !searchTrack && np.isPlaying

  return (
    <div className="space-y-6">
      {frozen ? (
        <div className="space-y-2">
          <TrackCard
            title={frozen.track.title}
            artist={frozen.track.artist}
            albumArt={frozen.track.albumArt}
            subtitle={`Moment captured at ${formatTime(frozen.progressMs)}`}
          />
          {!searchTrack && (
            <button
              type="button"
              onClick={recapture}
              className="text-xs text-accent hover:underline"
            >
              ↺ Recapture at current position ({formatTime(np.progressMs)})
            </button>
          )}
        </div>
      ) : (
        <TrackCard
          title={targetTrack.title}
          artist={targetTrack.artist}
          albumArt={targetTrack.albumArt}
          progressMs={searchTrack ? undefined : np.progressMs}
          durationMs={searchTrack ? undefined : targetTrack.durationMs}
          subtitle={
            searchTrack
              ? 'From search'
              : isLive
                ? 'Playing live — tap a focus to capture this moment'
                : 'Paused'
          }
        />
      )}

      <div className="space-y-3">
        {isFirst && (
          <p className="text-sm text-muted">Pick what you're noticing right now — one thing.</p>
        )}
        <FocusTypePicker selected={focusType} onSelect={selectFocus} />
      </div>

      {/* Focus-first: revealed only after a focus is chosen (moment now frozen) */}
      {focusType && frozen && (
        <div className="space-y-6 border-t border-border pt-6">
          <SensoryTagSelector selected={tags} onChange={setTags} showCategoryLabels={isFirst} />

          <div className="space-y-2">
            <label htmlFor="reflection" className="text-sm font-medium">
              Reflection <span className="font-normal text-muted">(optional)</span>
            </label>
            <textarea
              id="reflection"
              value={reflection}
              onChange={(e) => setReflection(e.target.value)}
              rows={3}
              placeholder="What are you noticing?"
              className="w-full resize-none rounded-xl border border-border bg-card p-3 outline-none focus:border-accent"
            />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-accent px-6 font-medium text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save moment'}
          </button>
        </div>
      )}
    </div>
  )
}
