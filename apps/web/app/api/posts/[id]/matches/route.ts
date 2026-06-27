// apps/web/app/api/posts/[id]/matches/route.ts
import { NextResponse, type NextRequest } from 'next/server'
import { eq } from 'drizzle-orm'
import type { MatchTier, PostMatchesResponse } from '@resonance/shared'
import { db } from '@/db'
import { postMatches, resonancePosts } from '@/db/schema'
import { getAuthedUser } from '@/lib/requireUser'
import { postToDTO } from '@/lib/mappers'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAuthedUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  // A match row links two posts; this post can be on either side, so collect
  // both directions and return the *other* post in each pair.
  const asA = await db
    .select({ match: postMatches, other: resonancePosts })
    .from(postMatches)
    .innerJoin(resonancePosts, eq(resonancePosts.id, postMatches.postBId))
    .where(eq(postMatches.postAId, id))

  const asB = await db
    .select({ match: postMatches, other: resonancePosts })
    .from(postMatches)
    .innerJoin(resonancePosts, eq(resonancePosts.id, postMatches.postAId))
    .where(eq(postMatches.postBId, id))

  const matches = [...asA, ...asB].map((r) => ({
    post: postToDTO(r.other),
    matchTier: r.match.matchTier as MatchTier,
  }))

  const body: PostMatchesResponse = { matches }
  return NextResponse.json(body)
}
