// apps/web/src/lib/requireUser.ts
import type { NextRequest } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { users } from '@/db/schema'
import { getSession } from '@/lib/auth'

/** Returns the authenticated user's DB row, or null if not authenticated. */
export async function getAuthedUser(request: NextRequest) {
  const session = await getSession(request)
  if (!session) return null

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1)

  return user ?? null
}
