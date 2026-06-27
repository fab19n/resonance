// apps/web/app/api/auth/me/route.ts
import { NextResponse, type NextRequest } from 'next/server'
import type { CurrentUser } from '@resonance/shared'
import { getAuthedUser } from '@/lib/requireUser'

export async function GET(request: NextRequest) {
  const user = await getAuthedUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body: CurrentUser = {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
  }
  return NextResponse.json(body)
}
