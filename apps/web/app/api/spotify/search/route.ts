// apps/web/app/api/spotify/search/route.ts
import { NextResponse, type NextRequest } from 'next/server'
import type { SearchResponse } from '@resonance/shared'
import { getAuthedUser } from '@/lib/requireUser'
import { getValidAccessToken, searchTracks } from '@/lib/spotify'

export async function GET(request: NextRequest) {
  const user = await getAuthedUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const query = request.nextUrl.searchParams.get('q')?.trim()
  if (!query) {
    return NextResponse.json({ error: 'Missing query parameter "q"' }, { status: 400 })
  }

  const accessToken = await getValidAccessToken(user)
  const tracks = await searchTracks(accessToken, query)

  const body: SearchResponse = { tracks }
  return NextResponse.json(body)
}
