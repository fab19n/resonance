// packages/shared/src/types.ts
//
// Canonical domain types shared across web (and later mobile).
// These describe the API/wire contract. They intentionally do NOT import
// from Drizzle — the DB layer maps its rows to these DTOs at the boundary,
// keeping `shared` free of server-only dependencies.

/**
 * The fixed set of 7 focus types. This array is the single source of truth
 * for the TS union. The Postgres enum in the DB schema mirrors these exact
 * values, in this exact order.
 */
export const FOCUS_TYPES = [
  'lyrics',
  'beat',
  'rhythm',
  'production',
  'instrumentation',
  'emotion',
  'structure',
] as const

export type FocusType = (typeof FOCUS_TYPES)[number]

/** Tier 0 = exact resonance. Tier 1 = same moment, different lens. */
export type MatchTier = 0 | 1

/** Validation rules referenced by the API layer and the UI. */
export const MAX_TAGS_PER_POST = 6
export const MAX_CUSTOM_TAG_LENGTH = 30
export const TOLERANCE_WINDOW_MS = 3000

/**
 * Body of POST /api/posts. Carries the full track (from now-playing or search)
 * so the server can upsert `tracks` before inserting the post — the post's isrc
 * FK requires the track row to exist, and re-fetching server-side would race
 * against playback changes and wouldn't cover search-based captures.
 */
export interface CreateResonancePayload {
  track: TrackSummary
  progressMs: number
  focusType: FocusType
  sensoryTags: string[]
  reflection?: string
}

/** JSON shape of a resonance post as returned by the API. */
export interface ResonancePostDTO {
  id: string
  userId: string
  isrc: string
  progressMs: number
  focusType: FocusType
  sensoryTags: string[] | null
  reflection: string | null
  createdAt: string
}

/** A single overlapping perception returned by the matching engine. */
export interface MatchResult {
  post: ResonancePostDTO
  matchTier: MatchTier
}

/** Response of POST /api/posts. isPioneer = no overlaps found (yet). */
export interface CreatePostResponse {
  post: ResonancePostDTO
  matches: MatchResult[]
  isPioneer: boolean
}

/** Response of GET /api/posts/:id/matches */
export interface PostMatchesResponse {
  matches: MatchResult[]
}

/** The authenticated user, as exposed to the client (never includes tokens). */
export interface CurrentUser {
  id: string
  username: string
  displayName: string | null
  avatarUrl: string | null
}

/** A track reduced to the fields the app cares about. */
export interface TrackSummary {
  isrc: string
  title: string
  artist: string
  albumName: string | null
  albumArt: string | null
  durationMs: number
  spotifyTrackId: string
}

/** Response of GET /api/spotify/now-playing */
export interface NowPlayingResponse {
  isPlaying: boolean
  progressMs: number | null
  track: TrackSummary | null
}

/** Response of GET /api/spotify/search */
export interface SearchResponse {
  tracks: TrackSummary[]
}
