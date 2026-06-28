// apps/web/app/api/profile/me/route.ts
import { NextResponse, type NextRequest } from 'next/server'
import { count, desc, eq, inArray, sql } from 'drizzle-orm'
import type { ProfileResponse, FocusType } from '@resonance/shared'
import { db } from '@/db'
import { resonancePosts, tracks, postMatches } from '@/db/schema'
import { getAuthedUser } from '@/lib/requireUser'

export async function GET(request: NextRequest) {
  const user = await getAuthedUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Focus-type distribution (and total) in one grouped query.
  const focusRows = await db
    .select({ focusType: resonancePosts.focusType, n: count() })
    .from(resonancePosts)
    .where(eq(resonancePosts.userId, user.id))
    .groupBy(resonancePosts.focusType)

  const focusTypeBreakdown: Partial<Record<FocusType, number>> = {}
  let totalPosts = 0
  for (const row of focusRows) {
    const n = Number(row.n)
    focusTypeBreakdown[row.focusType] = n
    totalPosts += n
  }

  // Top artists.
  const artistRows = await db
    .select({ artist: tracks.artist, n: count() })
    .from(resonancePosts)
    .innerJoin(tracks, eq(tracks.isrc, resonancePosts.isrc))
    .where(eq(resonancePosts.userId, user.id))
    .groupBy(tracks.artist)
    .orderBy(desc(sql`count(*)`))
    .limit(5)

  const topArtists = artistRows.map((r) => ({ artist: r.artist, count: Number(r.n) }))

  // Total matches across the user's posts.
  const ids = (
    await db
      .select({ id: resonancePosts.id })
      .from(resonancePosts)
      .where(eq(resonancePosts.userId, user.id))
  ).map((r) => r.id)

  let matchCount = 0
  if (ids.length > 0) {
    const [a] = await db
      .select({ n: count() })
      .from(postMatches)
      .where(inArray(postMatches.postAId, ids))
    const [b] = await db
      .select({ n: count() })
      .from(postMatches)
      .where(inArray(postMatches.postBId, ids))
    matchCount = Number(a?.n ?? 0) + Number(b?.n ?? 0)
  }

  const body: ProfileResponse = { totalPosts, focusTypeBreakdown, topArtists, matchCount }
  return NextResponse.json(body)
}
