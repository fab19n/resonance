// apps/web/src/services/matchingService.ts
import { and, eq, gte, lte, ne } from 'drizzle-orm'
import { TOLERANCE_WINDOW_MS, type MatchTier } from '@resonance/shared'
import type { Transaction } from '@/db'
import { resonancePosts, postMatches, notifications } from '@/db/schema'

export interface RawMatch {
  post: typeof resonancePosts.$inferSelect
  matchTier: MatchTier
}

/**
 * FR-3.1 / FR-3.2: query overlaps on ISRC + time window only; resolve the tier
 * in the application layer so Tier 1 (same moment, different focus) is never
 * eliminated at the DB level.
 *   Tier 0 = same focusType (exact resonance)
 *   Tier 1 = different focusType (same moment, different lens)
 */
export async function findOverlappingPerceptions(
  tx: Transaction,
  currentUserId: string,
  isrc: string,
  progressMs: number,
  focusType: string,
): Promise<RawMatch[]> {
  const rows = await tx
    .select()
    .from(resonancePosts)
    .where(
      and(
        eq(resonancePosts.isrc, isrc),
        gte(resonancePosts.progressMs, progressMs - TOLERANCE_WINDOW_MS),
        lte(resonancePosts.progressMs, progressMs + TOLERANCE_WINDOW_MS),
        ne(resonancePosts.userId, currentUserId),
      ),
    )

  return rows.map((post) => ({
    post,
    matchTier: post.focusType === focusType ? 0 : 1,
  }))
}

/**
 * FR-3.3 / FR-3.4: persist match pairs and notify the owners of the
 * pre-existing matched posts. The new poster sees their matches synchronously
 * in the POST response, so only the earlier posters are notified here — this is
 * exactly what fires a "pioneer" notification: an earlier zero-match post gets
 * its notification when a later post finally overlaps it.
 *
 * No-op when there are zero matches (the post stands as a pioneer until a
 * future post matches it).
 */
export async function persistMatchesAndNotify(
  tx: Transaction,
  newPostId: string,
  matches: RawMatch[],
): Promise<void> {
  if (matches.length === 0) return

  // postAId = the new post, postBId = the pre-existing matched post.
  const insertedMatches = await tx
    .insert(postMatches)
    .values(
      matches.map((m) => ({
        postAId: newPostId,
        postBId: m.post.id,
        matchTier: m.matchTier,
      })),
    )
    .returning({ id: postMatches.id, postBId: postMatches.postBId })

  const notifValues = insertedMatches.map((row) => {
    const matched = matches.find((m) => m.post.id === row.postBId)
    if (!matched) throw new Error('Match row/owner correlation failed')
    return {
      userId: matched.post.userId,
      type: 'new_match',
      matchId: row.id,
    }
  })

  await tx.insert(notifications).values(notifValues)
}
