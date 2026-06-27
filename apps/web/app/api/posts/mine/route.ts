// apps/web/app/api/posts/mine/route.ts
import { NextResponse, type NextRequest } from 'next/server'
import { desc, eq, inArray } from 'drizzle-orm'
import type { MyResonancesResponse, MyResonanceItem } from '@resonance/shared'
import { db } from '@/db'
import { resonancePosts, tracks, postMatches } from '@/db/schema'
import { getAuthedUser } from '@/lib/requireUser'
import { postToDTO } from '@/lib/mappers'

const DEFAULT_LIMIT = 20

export async function GET(request: NextRequest) {
  const user = await getAuthedUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const limitParam = Number(request.nextUrl.searchParams.get('limit'))
  const limit = Number.isInteger(limitParam) && limitParam > 0 && limitParam <= 100
    ? limitParam
    : DEFAULT_LIMIT

  const rows = await db
    .select({ post: resonancePosts, track: tracks })
    .from(resonancePosts)
    .innerJoin(tracks, eq(tracks.isrc, resonancePosts.isrc))
    .where(eq(resonancePosts.userId, user.id))
    .orderBy(desc(resonancePosts.createdAt))
    .limit(limit)

  // Match count per post = times it appears on either side of post_matches.
  // (A match never links two of the same user's posts, so no double counting.)
  const ids = rows.map((r) => r.post.id)
  const counts = new Map<string, number>()
  if (ids.length > 0) {
    const aRows = await db
      .select({ id: postMatches.postAId })
      .from(postMatches)
      .where(inArray(postMatches.postAId, ids))
    const bRows = await db
      .select({ id: postMatches.postBId })
      .from(postMatches)
      .where(inArray(postMatches.postBId, ids))
    for (const r of [...aRows, ...bRows]) {
      counts.set(r.id, (counts.get(r.id) ?? 0) + 1)
    }
  }

  const items: MyResonanceItem[] = rows.map((r) => ({
    post: postToDTO(r.post),
    track: {
      isrc: r.track.isrc,
      title: r.track.title,
      artist: r.track.artist,
      albumArt: r.track.albumArt,
    },
    matchCount: counts.get(r.post.id) ?? 0,
  }))

  const body: MyResonancesResponse = { items }
  return NextResponse.json(body)
}
