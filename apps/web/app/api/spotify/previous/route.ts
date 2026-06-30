// apps/web/app/api/spotify/previous/route.ts
import { NextResponse, type NextRequest } from 'next/server'
import { getAuthedUser } from '@/lib/requireUser'
import { getValidAccessToken, previousTrack } from '@/lib/spotify'

export async function POST(request: NextRequest) {
  const user = await getAuthedUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const accessToken = await getValidAccessToken(user)
  await previousTrack(accessToken)
  return new NextResponse(null, { status: 204 })
}
