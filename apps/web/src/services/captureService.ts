// apps/web/src/services/captureService.ts
import { inArray } from 'drizzle-orm'
import type { CreateResonancePayload, CreatePostResponse } from '@resonance/shared'
import { db } from '@/db'
import { tracks, platformTrackIds, resonancePosts, users } from '@/db/schema'
import { postToDTO } from '@/lib/mappers'
import { findOverlappingPerceptions, persistMatchesAndNotify } from './matchingService'

/**
 * The full capture pipeline, run in a single transaction so a post is never
 * persisted without its matches (and vice versa):
 *   1. Upsert the track  (FK target for the post)
 *   2. Map the Spotify ID → ISRC  (auxiliary cross-platform lookup)
 *   3. Insert the post
 *   4. Run the matching engine (range-aware)
 *   5. Persist matches + notify, append/check conversation anchors
 */
export async function createResonancePost(
  userId: string,
  payload: CreateResonancePayload,
): Promise<CreatePostResponse> {
  const {
    track,
    momentStartMs,
    momentEndMs,
    focusType,
    subLayer,
    sensoryTags,
    lyricText,
    reflection,
  } = payload

  const isrcSource = track.isrc.startsWith('spotify:') ? 'spotify_fallback' : 'verified'

  return db.transaction(async (tx) => {
    // 1. Ensure the track row exists. Metadata is treated as immutable once
    //    captured — first writer wins.
    await tx
      .insert(tracks)
      .values({
        isrc: track.isrc,
        title: track.title,
        artist: track.artist,
        albumName: track.albumName,
        albumArt: track.albumArt,
        durationMs: track.durationMs,
        isrcSource,
      })
      .onConflictDoNothing({ target: tracks.isrc })

    // 2. Record the Spotify → ISRC mapping (unique on isrc+platform).
    await tx
      .insert(platformTrackIds)
      .values({
        isrc: track.isrc,
        platform: 'spotify',
        platformTrackId: track.spotifyTrackId,
      })
      .onConflictDoNothing()

    // 3. Insert the post.
    const [post] = await tx
      .insert(resonancePosts)
      .values({
        userId,
        isrc: track.isrc,
        momentStartMs,
        momentEndMs: momentEndMs ?? null,
        focusType,
        subLayer: subLayer ?? null,
        sensoryTags: sensoryTags.length > 0 ? sensoryTags : null,
        lyricText: lyricText ?? null,
        reflection: reflection ?? null,
      })
      .returning()
    if (!post) throw new Error('Failed to insert resonance post')

    // 4. Match (range-aware).
    const rawMatches = await findOverlappingPerceptions(
      tx,
      userId,
      track.isrc,
      momentStartMs,
      momentEndMs ?? null,
      focusType,
    )

    // 5. Persist + notify + conversation anchors.
    const persistResults = await persistMatchesAndNotify(tx, post.id, userId, rawMatches)
    const resultsByPostId = new Map(persistResults.map((r) => [r.matchedPostId, r]))

    // Batch-fetch matched posts' owners so match cards can link to their
    // public profile — one query regardless of how many matches were found.
    const ownerIds = [...new Set(rawMatches.map((m) => m.post.userId))]
    const ownerRows = ownerIds.length > 0
      ? await tx.select().from(users).where(inArray(users.id, ownerIds))
      : []
    const ownerById = new Map(ownerRows.map((u) => [u.id, u]))

    return {
      post: postToDTO(post),
      matches: rawMatches.map((m) => {
        const convo = resultsByPostId.get(m.post.id)
        const owner = ownerById.get(m.post.userId)
        return {
          post: postToDTO(m.post),
          matchTier: m.matchTier,
          postOwner: owner
            ? {
                id: owner.id,
                username: owner.username,
                displayName: owner.displayName,
                avatarUrl: owner.avatarUrl,
              }
            : undefined,
          conversationId: convo?.conversationId ?? null,
          conversationStatus: convo?.conversationStatus ?? null,
        }
      }),
      isPioneer: rawMatches.length === 0,
    }
  })
}
