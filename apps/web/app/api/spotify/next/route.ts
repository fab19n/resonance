// apps/web/app/api/spotify/next/route.ts
import { NextResponse, type NextRequest } from 'next/server'
import { getAuthedUser } from '@/lib/requireUser'
import { getValidAccessToken, nextTrack } from '@/lib/spotify'

export async function POST(request: NextRequest) {
  const user = await getAuthedUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const accessToken = await getValidAccessToken(user)
  await nextTrack(accessToken)
  return new NextResponse(null, { status: 204 })
}
