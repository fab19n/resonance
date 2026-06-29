// apps/web/app/api/spotify/pause/route.ts
import { NextResponse, type NextRequest } from 'next/server'
import { getAuthedUser } from '@/lib/requireUser'
import { getValidAccessToken, pausePlayback } from '@/lib/spotify'

export async function PUT(request: NextRequest) {
  const user = await getAuthedUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const accessToken = await getValidAccessToken(user)
  await pausePlayback(accessToken)

  return new NextResponse(null, { status: 204 })
}
