// apps/web/app/api/notifications/[id]/read/route.ts
import { NextResponse, type NextRequest } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import { notifications } from '@/db/schema'
import { getAuthedUser } from '@/lib/requireUser'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAuthedUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  // Scope the update to the owner so a user can't mark others' notifications.
  await db
    .update(notifications)
    .set({ read: true })
    .where(and(eq(notifications.id, id), eq(notifications.userId, user.id)))

  return NextResponse.json({ ok: true })
}
