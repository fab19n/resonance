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
 * FR-3.1 / FR-3.2: find all posts whose moment range overlaps with the
 * incoming post's range, excluding the current user.
 *
 * Range overlap logic:
 *   - A point capture (momentEndMs = null) is treated as a degenerate range
 *     [momentStartMs, momentStartMs] with ±TOLERANCE applied.
 *   - Two ranges [a_start, a_end] and [b_start, b_end] overlap if:
 *       a_start <= b_end + TOLERANCE  AND  a_end >= b_start - TOLERANCE
 *
 * DB query fetches a superset (all posts whose start_ms falls in the
 * broadened window). The app layer applies the full overlap filter to avoid
 * eliminating valid range posts at the DB level.
 *
 * Focus type tier is resolved in the application layer so Tier 1 results
 * (same moment, different focus) are never eliminated at the DB level.
 *   Tier 0 = same focusType (exact resonance)
 *   Tier 1 = different focusType (same moment, different lens)
 */
export async function findOverlappingPerceptions(
  tx: Transaction,
  currentUserId: string,
  isrc: string,
  momentStartMs: number,
  momentEndMs: number | null,
  focusType: string,
): Promise<RawMatch[]> {
  const effectiveEnd = momentEndMs ?? momentStartMs

  // Broadened DB scan window — fetches all candidates that could possibly overlap
  const queryStart = momentStartMs - TOLERANCE_WINDOW_MS
  const queryEnd = effectiveEnd + TOLERANCE_WINDOW_MS

  const candidates = await tx
    .select()
    .from(resonancePosts)
    .where(
      and(
        eq(resonancePosts.isrc, isrc),
        gte(resonancePosts.momentStartMs, queryStart),
        lte(resonancePosts.momentStartMs, queryEnd),
        ne(resonancePosts.userId, currentUserId),
      ),
    )

  // Application-layer overlap filter
  const overlapping = candidates.filter((post) => {
    const postEnd = post.momentEndMs ?? post.momentStartMs
    return (
      momentStartMs <= postEnd + TOLERANCE_WINDOW_MS &&
      effectiveEnd >= post.momentStartMs - TOLERANCE_WINDOW_MS
    )
  })

  return overlapping.map((post) => ({
    post,
    matchTier: post.focusType === focusType ? 0 : 1,
  }))
}

/**
 * FR-3.3 / FR-3.4: persist match pairs and notify the owners of the
 * pre-existing matched posts. The new poster sees their matches synchronously
 * in the POST response, so only the earlier posters are notified here.
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
