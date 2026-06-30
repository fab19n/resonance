// apps/web/src/services/captureService.ts
import type { CreateResonancePayload, CreatePostResponse } from '@resonance/shared'
import { db } from '@/db'
import { tracks, platformTrackIds, resonancePosts } from '@/db/schema'
import { postToDTO } from '@/lib/mappers'
import { findOverlappingPerceptions, persistMatchesAndNotify } from './matchingService'

/**
 * The full capture pipeline, run in a single transaction so a post is never
 * persisted without its matches (and vice versa):
 *   1. Upsert the track  (FK target for the post)
 *   2. Map the Spotify ID → ISRC  (auxiliary cross-platform lookup)
 *   3. Insert the post
 *   4. Run the matching engine (range-aware)
 *   5. Persist matches + notify earlier posters
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

    // 5. Persist + notify.
    await persistMatchesAndNotify(tx, post.id, rawMatches)

    return {
      post: postToDTO(post),
      matches: rawMatches.map((m) => ({ post: postToDTO(m.post), matchTier: m.matchTier })),
      isPioneer: rawMatches.length === 0,
    }
  })
}
