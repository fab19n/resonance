// apps/web/src/components/PlayerScreen.tsx
'use client'

import { useState, useCallback } from 'react'
import type { CreatePostResponse, FocusType, SearchResponse, TrackSummary } from '@resonance/shared'
import { useNowPlaying } from '@/lib/useNowPlaying'
import { useLyrics } from '@/lib/useLyrics'
import { WaveformBar } from './WaveformBar'
import { SeekBar } from './SeekBar'
import { SyncedLyricsDisplay } from './SyncedLyricsDisplay'
import { PlayerControls } from './PlayerControls'
import { CaptureModal, type PendingCapture } from './CaptureModal'

export function PlayerScreen() {
  const np = useNowPlaying()

  // Search fallback
  const [searchTrack, setSearchTrack] = useState<TrackSummary | null>(null)
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState<TrackSummary[]>([])
  const [searching, setSearching] = useState(false)

  const activeTrack = searchTrack ?? np.track
  const isLiveTrack = !searchTrack

  const { lines: lrcLines, status: lyricsStatus } = useLyrics(activeTrack)
  const hasLyrics = lrcLines !== null && lrcLines.length > 0

  // Capture state
  const [pendingCapture, setPendingCapture] = useState<PendingCapture | null>(null)
  const [lastResult, setLastResult] = useState<CreatePostResponse | null>(null)

  // ── Player controls ───────────────────────────────────────────────────────

  const seek = useCallback(
    async (positionMs: number) => {
      await fetch(`/api/spotify/seek?position_ms=${positionMs}`, { method: 'PUT' }).catch(() => {})
      void np.refresh()
    },
    [np],
  )

  async function togglePlay() {
    const endpoint = np.isPlaying ? '/api/spotify/pause' : '/api/spotify/play'
    await fetch(endpoint, { method: 'PUT' }).catch(() => {})
    setTimeout(() => void np.refresh(), 500)
  }

  async function previousTrack() {
    await fetch('/api/spotify/previous', { method: 'POST' }).catch(() => {})
    setTimeout(() => void np.refresh(), 600)
  }

  async function nextTrack() {
    await fetch('/api/spotify/next', { method: 'POST' }).catch(() => {})
    setTimeout(() => void np.refresh(), 600)
  }

  // ── Capture handlers ──────────────────────────────────────────────────────

  function openCapture(pending: PendingCapture) {
    if (!activeTrack) return
    setPendingCapture(pending)
  }

  // From waveform: tap or drag
  function handleWaveformCapturePoint(ms: number) {
    openCapture({ startMs: ms, endMs: null })
  }

  function handleWaveformCaptureRange(startMs: number, endMs: number) {
    openCapture({ startMs, endMs })
  }

  // From lyrics: tap selection (Lyrics layer pre-selected)
  function handleLyricsCapture(startMs: number, endMs: number, lyricText: string) {
    openCapture({
      startMs,
      endMs,
      lyricText,
      preselectedLayer: 'lyrics' as FocusType,
    })
  }

  // ── Search ────────────────────────────────────────────────────────────────

  async function runSearch() {
    if (!query.trim()) return
    setSearching(true)
    const res = await fetch(`/api/spotify/search?q=${encodeURIComponent(query.trim())}`)
    const data: SearchResponse = res.ok ? await res.json() : { tracks: [] }
    setSearchResults(data.tracks)
    setSearching(false)
  }

  // ── Loading / empty ───────────────────────────────────────────────────────

  if (np.status === 'loading') {
    return <p className="text-muted">Detecting what you're listening to…</p>
  }

  if (!activeTrack) {
    return (
      <div className="space-y-4">
        <p className="text-muted">Nothing playing. Find a song you've been listening to.</p>
        <div className="flex gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void runSearch() }}
            placeholder="Search Spotify…"
            className="min-h-12 flex-1 rounded-xl border border-border bg-card px-4 outline-none focus:border-accent"
          />
          <button
            type="button"
            onClick={() => void runSearch()}
            disabled={searching}
            className="min-h-12 rounded-xl bg-accent px-5 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {searching ? '…' : 'Search'}
          </button>
        </div>
        <div className="space-y-2">
          {searchResults.map((t) => (
            <button
              key={t.spotifyTrackId}
              type="button"
              onClick={() => { setSearchTrack(t); setSearchResults([]); setQuery('') }}
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

  // ── Player ────────────────────────────────────────────────────────────────

  const currentProgressMs = isLiveTrack ? np.progressMs : 0
  const durationMs = activeTrack.durationMs

  return (
    <>
      <div className="space-y-4">
        {/* Track info */}
        <div className="flex items-center gap-4">
          {activeTrack.albumArt ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={activeTrack.albumArt}
              alt=""
              width={64}
              height={64}
              className="rounded-xl shadow-sm"
            />
          ) : (
            <div className="h-16 w-16 rounded-xl bg-border" />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold leading-tight">{activeTrack.title}</p>
            <p className="truncate text-sm text-muted">{activeTrack.artist}</p>
          </div>
        </div>

        {/* Lyrics — scroll to seek, tap to capture */}
        {hasLyrics ? (
          <SyncedLyricsDisplay
            lines={lrcLines!}
            progressMs={currentProgressMs}
            durationMs={durationMs}
            onSeek={seek}
            onLyricsCapture={handleLyricsCapture}
          />
        ) : lyricsStatus === 'loading' ? (
          <div className="flex flex-col items-center justify-center gap-2.5 px-8" style={{ height: 220 }}>
            {[65, 85, 55, 75, 45].map((w, i) => (
              <div
                key={i}
                className="h-2.5 animate-pulse rounded-full bg-border"
                style={{ width: `${w}%`, animationDelay: `${i * 80}ms` }}
              />
            ))}
          </div>
        ) : (
          // No lyrics placeholder — same height as lyrics area for stable layout
          <div className="flex items-center justify-center" style={{ height: 220 }}>
            <p className="text-xs text-muted/40">No lyrics available</p>
          </div>
        )}

        {/* Waveform bar — always capture, regardless of lyrics */}
        <WaveformBar
          seed={activeTrack.isrc}
          durationMs={durationMs}
          progressMs={currentProgressMs}
          onCapturePoint={handleWaveformCapturePoint}
          onCaptureRange={handleWaveformCaptureRange}
        />

        {/* Seek bar — only when no lyrics (lyrics scroll handles seek otherwise) */}
        {!hasLyrics && lyricsStatus !== 'loading' && (
          <SeekBar
            progressMs={currentProgressMs}
            durationMs={durationMs}
            onSeek={seek}
          />
        )}

        {/* Controls */}
        <PlayerControls
          isPlaying={np.isPlaying}
          isLive={isLiveTrack}
          onTogglePlay={() => void togglePlay()}
          onPrevious={() => void previousTrack()}
          onNext={() => void nextTrack()}
          onSeek={seek}
          currentProgressMs={currentProgressMs}
          durationMs={durationMs}
        />

        {/* Last result hint */}
        {lastResult && !pendingCapture && (
          <p className="text-center text-xs text-muted">
            {lastResult.isPioneer
              ? "You're the first here. We'll notify you when someone resonates."
              : `${lastResult.matches.length} resonance${lastResult.matches.length === 1 ? '' : 's'} found`}
          </p>
        )}
      </div>

      {pendingCapture && activeTrack && (
        <CaptureModal
          track={activeTrack}
          pending={pendingCapture}
          lrcLines={lrcLines}
          onSave={(r) => setLastResult(r)}
          onDismiss={() => setPendingCapture(null)}
        />
      )}
    </>
  )
}