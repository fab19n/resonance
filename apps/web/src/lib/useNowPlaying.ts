// apps/web/src/lib/useNowPlaying.ts
import { useCallback, useEffect, useRef, useState } from 'react'
import type { NowPlayingResponse, TrackSummary } from '@resonance/shared'

// Poll Spotify on a light interval and interpolate progress locally between
// polls. This keeps the progress bar smooth without hitting the API every
// frame: the poll corrects drift and detects track changes; the local ticker
// advances the position in real time.
const POLL_MS = 5000
const TICK_MS = 500

export type NowPlayingStatus = 'loading' | 'idle' | 'active'

interface Baseline {
  progressMs: number
  syncedAt: number
  isPlaying: boolean
  track: TrackSummary | null
}

export interface LiveNowPlaying {
  status: NowPlayingStatus
  track: TrackSummary | null
  isPlaying: boolean
  progressMs: number // live, ticking value for display
  getProgressMs: () => number // exact current value, for the capture instant
  refresh: () => Promise<void>
}

export function useNowPlaying(): LiveNowPlaying {
  const [status, setStatus] = useState<NowPlayingStatus>('loading')
  const [track, setTrack] = useState<TrackSummary | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [progressMs, setProgressMs] = useState(0)
  const baseline = useRef<Baseline>({
    progressMs: 0,
    syncedAt: 0,
    isPlaying: false,
    track: null,
  })

  // Compute the live position from the last authoritative sync.
  const compute = useCallback(() => {
    const b = baseline.current
    if (!b.track) return 0
    const raw = b.isPlaying ? b.progressMs + (Date.now() - b.syncedAt) : b.progressMs
    return Math.min(raw, b.track.durationMs)
  }, [])

  const sync = useCallback(async () => {
    try {
      const res = await fetch('/api/spotify/now-playing')
      const data: NowPlayingResponse = res.ok
        ? await res.json()
        : { isPlaying: false, progressMs: null, track: null }
      baseline.current = {
        progressMs: data.progressMs ?? 0,
        syncedAt: Date.now(),
        isPlaying: data.isPlaying,
        track: data.track,
      }
      setTrack(data.track)
      setIsPlaying(data.isPlaying)
      setProgressMs(data.progressMs ?? 0)
      setStatus(data.track ? 'active' : 'idle')
    } catch {
      // Keep prior state; the next poll retries.
    }
  }, [])

  // Initial fetch + polling. Skip polling while the tab is hidden to respect
  // Spotify's rate limits.
  useEffect(() => {
    void sync()
    const id = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return
      void sync()
    }, POLL_MS)
    return () => clearInterval(id)
  }, [sync])

  // Local interpolation ticker for smooth progress.
  useEffect(() => {
    const id = setInterval(() => {
      if (!baseline.current.track) return
      setProgressMs(compute())
    }, TICK_MS)
    return () => clearInterval(id)
  }, [compute])

  return { status, track, isPlaying, progressMs, getProgressMs: compute, refresh: sync }
}
