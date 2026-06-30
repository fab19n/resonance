// apps/web/app/api/spotify/play-at/route.ts
//
// Resolves a Resonance ISRC to its Spotify track ID, then plays that track
// from a specific position on the user's active device. Powers the tappable
// timestamp on captured moments — "play this from where it was heard."

import { NextResponse, type NextRequest } from 'next/server'
import { and, eq } from 'drizzle-orm'
import type { PlayAtResponse } from '@resonance/shared'
import { db } from '@/db'
import { platformTrackIds } from '@/db/schema'
import { getAuthedUser } from '@/lib/requireUser'
import { getValidAccessToken, playTrackAt } from '@/lib/spotify'

export async function PUT(request: NextRequest) {
  const user = await getAuthedUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let json: unknown
  try {
    json = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const b = json as Record<string, unknown>
  if (typeof b.isrc !== 'string' || b.isrc.length === 0) {
    return NextResponse.json({ error: 'isrc is required' }, { status: 400 })
  }
  if (typeof b.positionMs !== 'number' || b.positionMs < 0) {
    return NextResponse.json({ error: 'positionMs must be a non-negative number' }, { status: 400 })
  }

  // Resolve the Spotify track ID. spotify_fallback ISRCs ("spotify:{id}")
  // carry the ID directly; verified ISRCs look it up via platformTrackIds.
  let spotifyTrackId: string
  if (b.isrc.startsWith('spotify:')) {
    spotifyTrackId = b.isrc.slice('spotify:'.length)
  } else {
    const [mapping] = await db
      .select()
      .from(platformTrackIds)
      .where(and(eq(platformTrackIds.isrc, b.isrc), eq(platformTrackIds.platform, 'spotify')))
      .limit(1)

    if (!mapping) {
      const body: PlayAtResponse = { ok: false, errorCode: 'track_not_found' }
      return NextResponse.json(body)
    }
    spotifyTrackId = mapping.platformTrackId
  }

  const accessToken = await getValidAccessToken(user)
  const result = await playTrackAt(accessToken, spotifyTrackId, b.positionMs)

  const body: PlayAtResponse = result
  return NextResponse.json(body)
}
