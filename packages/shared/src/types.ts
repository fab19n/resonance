// packages/shared/src/types.ts
//
// Canonical domain types shared across web (and later mobile).
// These describe the API/wire contract. They intentionally do NOT import
// from Drizzle — the DB layer maps its rows to these DTOs at the boundary,
// keeping `shared` free of server-only dependencies.

/**
 * The fixed set of 8 focus types. This array is the single source of truth
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
  'vocals',
] as const

export type FocusType = (typeof FOCUS_TYPES)[number]

/** Human-readable labels for focus types (UI display). */
export const FOCUS_TYPE_LABELS: Record<FocusType, string> = {
  lyrics: 'Lyrics',
  beat: 'Beat',
  rhythm: 'Rhythm',
  production: 'Production',
  instrumentation: 'Instrumentation',
  emotion: 'Emotion',
  structure: 'Structure',
  vocals: 'Vocals',
}

/** Tier 0 = exact resonance. Tier 1 = same moment, different lens. */
export type MatchTier = 0 | 1

/** Validation rules referenced by the API layer and the UI. */
export const MAX_TAGS_PER_POST = 6
export const MAX_CUSTOM_TAG_LENGTH = 30
export const TOLERANCE_WINDOW_MS = 3000

/**
 * Body of POST /api/posts.
 *
 * momentStartMs: the anchor timestamp in the track (ms).
 * momentEndMs:   end of a range capture. null = point capture.
 * subLayer:      optional refinement within the chosen focusType.
 * lyricText:     set only when the capture originated from a lyric tap.
 *                Contains the selected lyric line(s) text.
 *
 * Carries the full track so the server can upsert `tracks` before inserting
 * the post — the post's ISRC FK requires the track row to exist.
 */
export interface CreateResonancePayload {
  track: TrackSummary
  momentStartMs: number
  momentEndMs?: number | null
  focusType: FocusType
  subLayer?: string | null
  sensoryTags: string[]
  lyricText?: string | null
  reflection?: string
}

/** JSON shape of a resonance post as returned by the API. */
export interface ResonancePostDTO {
  id: string
  userId: string
  isrc: string
  momentStartMs: number
  momentEndMs: number | null
  focusType: FocusType
  subLayer: string | null
  sensoryTags: string[] | null
  lyricText: string | null
  reflection: string | null
  createdAt: string
}

/**
 * A single overlapping perception returned by the matching engine.
 * conversationId/conversationStatus are populated when the new poster and
 * the matched post's owner already have a conversation — lets the UI offer
 * "View conversation" instead of "Start a conversation" on that match card.
 * postOwner identifies who the match is with, so the card can link to their
 * public profile.
 */
export interface MatchResult {
  post: ResonancePostDTO
  matchTier: MatchTier
  postOwner?: UserRef
  conversationId?: string | null
  conversationStatus?: ConversationStatus | null
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

/** Minimal track fields for list display. */
export interface TrackRef {
  isrc: string
  title: string
  artist: string
  albumArt: string | null
}

/** One row in the "My Resonances" surface. */
export interface MyResonanceItem {
  post: ResonancePostDTO
  track: TrackRef
  matchCount: number
}

/** Response of GET /api/posts/mine */
export interface MyResonancesResponse {
  items: MyResonanceItem[]
}

/** Profile aggregates (GET /api/profile/me). Personal only — no comparisons. */
export interface ArtistCount {
  artist: string
  count: number
}
export interface ProfileResponse {
  totalPosts: number
  focusTypeBreakdown: Partial<Record<FocusType, number>>
  topArtists: ArtistCount[]
  matchCount: number
}

/**
 * Public profile (GET /api/users/:username) — what another Resonance user
 * sees of someone's listening identity. Deliberately carries no counts of
 * any kind: focusWeights are pre-normalized server-side (0..1, relative to
 * that person's own top focus type) so even the raw JSON payload can't be
 * used to reverse-engineer an exact capture total. topArtists is names only.
 */
export interface PublicProfileResponse {
  user: UserRef
  focusWeights: Partial<Record<FocusType, number>>
  topArtists: string[]
}

/**
 * In-app notification (GET /api/notifications), enriched for display.
 * conversationId is set for chat-related types so the bell can route taps
 * straight to the conversation rather than the track.
 */
export interface NotificationDTO {
  id: string
  type: string
  read: boolean
  createdAt: string
  matchId: string | null
  matchTier: MatchTier | null
  trackTitle: string | null
  trackArtist: string | null
  isrc: string | null
  conversationId: string | null
}
export interface NotificationsResponse {
  notifications: NotificationDTO[]
  unreadCount: number
}

/** Track view (GET /api/tracks/:isrc/moments): posts grouped into clusters. */
export interface MomentCluster {
  centerMs: number
  posts: ResonancePostDTO[]
}
export interface TrackMomentsResponse {
  track: {
    isrc: string
    title: string
    artist: string
    albumArt: string | null
    durationMs: number
  }
  clusters: MomentCluster[]
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

/**
 * Response of GET /api/spotify/now-playing.
 * progressMs here is Spotify's live playback position — distinct from
 * momentStartMs which is the captured anchor stored in the DB.
 */
export interface NowPlayingResponse {
  isPlaying: boolean
  progressMs: number | null
  track: TrackSummary | null
}

/** Response of GET /api/spotify/search */
export interface SearchResponse {
  tracks: TrackSummary[]
}

/**
 * Body of PUT /api/spotify/play-at — starts playback of a specific track at
 * a specific position on the user's active Spotify device. Used to make a
 * captured moment's timestamp tappable: "play this from where it was heard."
 */
export interface PlayAtRequest {
  isrc: string
  positionMs: number
}

/**
 * errorCode lets each platform's UI choose its own wording (web vs. future
 * Expo) while sharing the same underlying classification.
 *   no_active_device — nothing is open on Spotify anywhere right now
 *   premium_required — the viewer's Spotify account isn't Premium
 *   track_not_found  — no Spotify mapping exists for this ISRC (shouldn't
 *                       happen for posts captured through Resonance)
 *   unknown          — anything else
 */
export type PlayAtErrorCode = 'no_active_device' | 'premium_required' | 'track_not_found' | 'unknown'

export interface PlayAtResponse {
  ok: boolean
  errorCode?: PlayAtErrorCode
}

/**
 * One line from a synced LRC lyrics response.
 * timestampMs: position in the track this line starts.
 */
export interface LrcLine {
  timestampMs: number
  text: string
}

/** Response of GET /api/lyrics */
export interface LyricsResponse {
  syncedLines: LrcLine[] | null  // null = no synced lyrics available
  plainLyrics: string | null
}

// ── Conversations / Chat ─────────────────────────────────────────────────

/**
 * 'pending'  — initiator sent an opening message, recipient hasn't replied.
 *              No expiry — sits until replied to or ignored.
 * 'active'   — recipient replied at least once; free messaging both ways.
 */
export type ConversationStatus = 'pending' | 'active'

/** Minimal user info shown in chat contexts — never includes tokens or email. */
export interface UserRef {
  id: string
  username: string
  displayName: string | null
  avatarUrl: string | null
}

/**
 * The full context of a single match, from the viewer's perspective.
 * myPost / theirPost are resolved relative to whoever is viewing — the same
 * match returns different myPost/theirPost depending on which side asks.
 */
export interface MatchAnchorDTO {
  matchId: string
  track: TrackRef
  myPost: ResonancePostDTO
  theirPost: ResonancePostDTO
  matchTier: MatchTier
}

/** One anchor card inside a conversation thread — wraps a MatchAnchorDTO with its own timeline position. */
export interface ConversationAnchorDTO {
  id: string // the underlying match id
  anchor: MatchAnchorDTO
  createdAt: string
}

export interface MessageDTO {
  id: string
  conversationId: string
  senderId: string
  body: string
  createdAt: string
}

/** Row in the conversations list (GET /api/conversations). */
export interface ConversationSummaryDTO {
  id: string
  otherUser: UserRef
  status: ConversationStatus
  isInitiator: boolean
  lastMessage: { body: string; senderId: string; createdAt: string } | null
  unreadCount: number
  createdAt: string
}

export interface ConversationsListResponse {
  conversations: ConversationSummaryDTO[]
}

/** Full thread (GET /api/conversations/:id) — messages + every matched anchor. */
export interface ConversationDetailDTO {
  id: string
  otherUser: UserRef
  status: ConversationStatus
  isInitiator: boolean
  messages: MessageDTO[]
  anchors: ConversationAnchorDTO[]
  createdAt: string
}

/** Body of POST /api/conversations */
export interface CreateConversationPayload {
  matchId: string
  body: string
}

/** Body of POST /api/conversations/:id/messages */
export interface SendMessagePayload {
  body: string
}

/**
 * Response of GET /api/matches/:matchId — the earlier poster's entry point
 * into a match from their notification. Includes whether a conversation
 * already exists so the UI can offer "Start" vs "Continue".
 */
export interface MatchDetailResponse {
  matchId: string
  track: TrackRef
  myPost: ResonancePostDTO
  theirPost: ResonancePostDTO
  matchTier: MatchTier
  otherUser: UserRef
  conversationId: string | null
  conversationStatus: ConversationStatus | null
}
