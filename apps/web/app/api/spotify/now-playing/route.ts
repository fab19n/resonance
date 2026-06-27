// apps/web/app/api/spotify/now-playing/route.ts
import { NextResponse, type NextRequest } from 'next/server'
import type { NowPlayingResponse } from '@resonance/shared'
import { getAuthedUser } from '@/lib/requireUser'
import { getValidAccessToken, getCurrentlyPlaying } from '@/lib/spotify'

export async function GET(request: NextRequest) {
  const user = await getAuthedUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const accessToken = await getValidAccessToken(user)
  const nowPlaying = await getCurrentlyPlaying(accessToken)

  const body: NowPlayingResponse = nowPlaying
  return NextResponse.json(body)
}
