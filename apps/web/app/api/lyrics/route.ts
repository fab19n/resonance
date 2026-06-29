// apps/web/app/api/lyrics/route.ts
//
// Proxy to LRCLib (https://lrclib.net) — free, no API key required.
// Uses the search endpoint (fuzzy match) rather than get (exact duration match)
// because Spotify's reported duration often differs slightly from LRCLib's record,
// causing exact-match 404s on valid tracks.

import { NextResponse, type NextRequest } from 'next/server'
import type { LyricsResponse, LrcLine } from '@resonance/shared'
import { getAuthedUser } from '@/lib/requireUser'

const LRCLIB_BASE = 'https://lrclib.net/api'
const TIMEOUT_MS = 10_000

interface LrcLibResult {
  id: number
  trackName: string
  artistName: string
  duration: number
  syncedLyrics: string | null
  plainLyrics: string | null
  instrumental: boolean
}

/**
 * Parses an LRC-format string into timestamped lines.
 * Format: [mm:ss.xx] lyric text
 */
function parseLrc(lrc: string): LrcLine[] {
  const lines: LrcLine[] = []
  const RE = /\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/g
  let match: RegExpExecArray | null

while ((match = RE.exec(lrc)) !== null) {
  const [, minutesStr, secondsStr, csRaw, text] = match

  if (
    minutesStr === undefined ||
    secondsStr === undefined ||
    csRaw === undefined ||
    text === undefined
  ) {
    continue
  }

  const minutes = parseInt(minutesStr, 10)
  const seconds = parseInt(secondsStr, 10)
  const ms =
    csRaw.length === 3
      ? parseInt(csRaw, 10)
      : parseInt(csRaw, 10) * 10

  lines.push({
    timestampMs: (minutes * 60 + seconds) * 1000 + ms,
    text: text.trim(),
  })
}

  return lines.sort((a, b) => a.timestampMs - b.timestampMs)
}

export async function GET(request: NextRequest) {
  const user = await getAuthedUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = request.nextUrl
  const artist = searchParams.get('artist')
  const title = searchParams.get('title')

  if (!artist || !title) {
    return NextResponse.json(
      { error: 'artist and title query params are required' },
      { status: 400 },
    )
  }

  const empty: LyricsResponse = { syncedLines: null, plainLyrics: null }

  // Use the search endpoint — fuzzy match on artist + title, no duration needed
  const params = new URLSearchParams({
    artist_name: artist,
    track_name: title,
  })

  let res: Response
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)

    res = await fetch(`${LRCLIB_BASE}/search?${params.toString()}`, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Resonance/1.0 (https://resonance.vercel.app)',
        'Accept': 'application/json',
      },
    })
    clearTimeout(timeoutId)
  } catch {
    // Timeout or network error
    return NextResponse.json(empty)
  }

  if (!res.ok) {
    return NextResponse.json(empty)
  }

  let results: LrcLibResult[]
  try {
    results = (await res.json()) as LrcLibResult[]
  } catch {
    return NextResponse.json(empty)
  }

  if (!Array.isArray(results) || results.length === 0) {
    return NextResponse.json(empty)
  }

  // Prefer a result with synced lyrics, fall back to first result
  const best = results.find((r) => r.syncedLyrics && !r.instrumental) ?? results[0]

  if (!best) {
    return NextResponse.json(empty)
  }

  const syncedLines = best.syncedLyrics ? parseLrc(best.syncedLyrics) : null

  const body: LyricsResponse = {
    syncedLines,
    plainLyrics: best.plainLyrics ?? null,
  }

  return NextResponse.json(body)
}