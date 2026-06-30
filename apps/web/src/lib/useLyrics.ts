// apps/web/src/lib/useLyrics.ts
//
// Fetches synced lyrics directly from LRCLib in the browser.
// Module-level cache keyed by ISRC — same track is always instant after
// the first fetch. Cache lives for the browser session.

import { useState, useEffect } from 'react'
import type { LrcLine, TrackSummary } from '@resonance/shared'

const LRCLIB_BASE = 'https://lrclib.net/api'

// null = confirmed unavailable, LrcLine[] = cached result
const cache = new Map<string, LrcLine[] | null>()

export type LyricsStatus = 'idle' | 'loading' | 'ready' | 'unavailable'

export interface LyricsState {
  lines: LrcLine[] | null
  status: LyricsStatus
}

interface LrcLibResult {
  syncedLyrics: string | null
  instrumental: boolean
}

function parseLrc(lrc: string): LrcLine[] {
  const lines: LrcLine[] = []
  const RE = /\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/g
  let match: RegExpExecArray | null
  while ((match = RE.exec(lrc)) !== null) {
    // Non-null assertions: noUncheckedIndexedAccess types match[N] as
    // string | undefined, but these groups are guaranteed present — the
    // regex requires all four to match for RE.exec to succeed at all.
    const minutes = parseInt(match[1]!, 10)
    const seconds = parseInt(match[2]!, 10)
    const csRaw = match[3]!
    const ms = csRaw.length === 3 ? parseInt(csRaw, 10) : parseInt(csRaw, 10) * 10
    const timestampMs = (minutes * 60 + seconds) * 1000 + ms
    const text = match[4]!.trim()
    lines.push({ timestampMs, text })
  }
  return lines.sort((a, b) => a.timestampMs - b.timestampMs)
}

export function useLyrics(track: TrackSummary | null): LyricsState {
  const cached = track ? cache.get(track.isrc) : undefined
  const [state, setState] = useState<LyricsState>(() => {
    if (!track) return { lines: null, status: 'idle' }
    if (cached !== undefined) {
      return { lines: cached, status: cached ? 'ready' : 'unavailable' }
    }
    return { lines: null, status: 'loading' }
  })

  useEffect(() => {
    if (!track) {
      setState({ lines: null, status: 'idle' })
      return
    }

    // Cache hit — no fetch needed
    if (cache.has(track.isrc)) {
      const hit = cache.get(track.isrc) ?? null
      setState({ lines: hit, status: hit ? 'ready' : 'unavailable' })
      return
    }

    let cancelled = false
    setState({ lines: null, status: 'loading' })

    const params = new URLSearchParams({
      artist_name: track.artist,
      track_name: track.title,
    })

    fetch(`${LRCLIB_BASE}/search?${params.toString()}`, {
      headers: { 'Accept': 'application/json' },
    })
      .then((res) => (res.ok ? (res.json() as Promise<LrcLibResult[]>) : Promise.resolve([])))
      .then((results) => {
        if (cancelled) return
        const best = Array.isArray(results)
          ? results.find((r) => r.syncedLyrics && !r.instrumental) ?? null
          : null
        const lines = best?.syncedLyrics ? parseLrc(best.syncedLyrics) : null
        const finalLines = lines && lines.length > 0 ? lines : null
        cache.set(track.isrc, finalLines)
        setState({ lines: finalLines, status: finalLines ? 'ready' : 'unavailable' })
      })
      .catch(() => {
        if (cancelled) return
        cache.set(track.isrc, null)
        setState({ lines: null, status: 'unavailable' })
      })

    return () => { cancelled = true }
  }, [track?.isrc])

  return state
}