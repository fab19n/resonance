// apps/web/app/api/users/[username]/route.ts
//
// Public listening-identity view of another Resonance user. Anti-vanity by
// design: focusWeights are normalized server-side (0..1, relative to that
// person's own top focus type), never raw counts — the JSON payload itself
// carries no number a viewer could use to infer "this person has captured
// exactly N times." topArtists is names only, same reasoning.

import { NextResponse, type NextRequest } from 'next/server'
import { count, desc, eq, sql } from 'drizzle-orm'
import type { PublicProfileResponse, FocusType } from '@resonance/shared'
import { db } from '@/db'
import { users, resonancePosts, tracks } from '@/db/schema'
import { getAuthedUser } from '@/lib/requireUser'

const TOP_ARTISTS_LIMIT = 5

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> },
) {
  // "Public" means visible to other signed-in Resonance users without a
  // follow/consent gate — not visible to the open internet. Every other
  // surface in the app requires auth; this stays consistent with that.
  const viewer = await getAuthedUser(request)
  if (!viewer) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { username } = await params

  const [profileUser] = await db.select().from(users).where(eq(users.username, username)).limit(1)
  if (!profileUser) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const focusRows = await db
    .select({ focusType: resonancePosts.focusType, n: count() })
    .from(resonancePosts)
    .where(eq(resonancePosts.userId, profileUser.id))
    .groupBy(resonancePosts.focusType)

  const maxCount = focusRows.reduce((max, r) => Math.max(max, Number(r.n)), 0)
  const focusWeights: Partial<Record<FocusType, number>> = {}
  for (const row of focusRows) {
    focusWeights[row.focusType] = maxCount > 0 ? Number(row.n) / maxCount : 0
  }

  const artistRows = await db
    .select({ artist: tracks.artist, n: count() })
    .from(resonancePosts)
    .innerJoin(tracks, eq(tracks.isrc, resonancePosts.isrc))
    .where(eq(resonancePosts.userId, profileUser.id))
    .groupBy(tracks.artist)
    .orderBy(desc(sql`count(*)`))
    .limit(TOP_ARTISTS_LIMIT)

  const body: PublicProfileResponse = {
    user: {
      id: profileUser.id,
      username: profileUser.username,
      displayName: profileUser.displayName,
      avatarUrl: profileUser.avatarUrl,
    },
    focusWeights,
    topArtists: artistRows.map((r) => r.artist),
  }

  return NextResponse.json(body)
}
