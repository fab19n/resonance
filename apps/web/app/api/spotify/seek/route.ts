// apps/web/app/api/spotify/seek/route.ts
//
// Proxies PUT /v1/me/player/seek to move Spotify playback to a position.
// Requires the user-modify-playback-state scope (included in SPOTIFY_SCOPES).

import { NextResponse, type NextRequest } from 'next/server'
import { getAuthedUser } from '@/lib/requireUser'
import { getValidAccessToken, seekToPosition } from '@/lib/spotify'

export async function PUT(request: NextRequest) {
  const user = await getAuthedUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const positionMs = request.nextUrl.searchParams.get('position_ms')
  if (!positionMs || isNaN(Number(positionMs))) {
    return NextResponse.json(
      { error: 'position_ms query param is required and must be a number' },
      { status: 400 },
    )
  }

  const accessToken = await getValidAccessToken(user)
  await seekToPosition(accessToken, Number(positionMs))

  // Spotify returns 204 No Content on success
  return new NextResponse(null, { status: 204 })
}
