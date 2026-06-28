// apps/web/app/api/notifications/read-all/route.ts
import { NextResponse, type NextRequest } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import { notifications } from '@/db/schema'
import { getAuthedUser } from '@/lib/requireUser'

export async function POST(request: NextRequest) {
  const user = await getAuthedUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  await db
    .update(notifications)
    .set({ read: true })
    .where(and(eq(notifications.userId, user.id), eq(notifications.read, false)))

  return NextResponse.json({ ok: true })
}
