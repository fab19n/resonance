// apps/web/src/db/schema.ts
import {
  pgTable, pgEnum, uuid, varchar, integer,
  text, timestamp, boolean, index, unique,
} from 'drizzle-orm/pg-core'

// Mirrors FOCUS_TYPES in @resonance/shared — same values, same order.
export const focusTypeEnum = pgEnum('focus_type', [
  'lyrics', 'beat', 'rhythm', 'production',
  'instrumentation', 'emotion', 'structure', 'vocals',
])

// ── Users ──────────────────────────────────────────────────────────────────
export const users = pgTable('users', {
  id:                    uuid('id').primaryKey().defaultRandom(),
  username:              varchar('username', { length: 50 }).notNull().unique(),
  displayName:           varchar('display_name', { length: 100 }),
  avatarUrl:             text('avatar_url'),
  email:                 varchar('email', { length: 255 }).unique(),
  spotifyId:             varchar('spotify_id', { length: 50 }).notNull().unique(),
  spotifyAccessToken:    text('spotify_access_token').notNull(),
  spotifyRefreshToken:   text('spotify_refresh_token').notNull(),
  spotifyTokenExpiresAt: timestamp('spotify_token_expires_at').notNull(),
  createdAt:             timestamp('created_at').defaultNow().notNull(),
})

// ── Tracks ─────────────────────────────────────────────────────────────────
// isrc is the universal primary key. 'spotify_fallback' tracks use a
// synthetic key of 'spotify:{spotifyTrackId}' when ISRC is absent.
export const tracks = pgTable('tracks', {
  isrc:       varchar('isrc', { length: 40 }).primaryKey(),
  title:      varchar('title', { length: 255 }).notNull(),
  artist:     varchar('artist', { length: 255 }).notNull(),
  albumName:  varchar('album_name', { length: 255 }),
  albumArt:   text('album_art_url'),
  durationMs: integer('duration_ms').notNull(),
  isrcSource: varchar('isrc_source', { length: 20 }).notNull().default('verified'),
  // values: 'verified' | 'spotify_fallback'
})

// ── Platform Track IDs ──────────────────────────────────────────────────────
// Auxiliary lookup map. Stores platform-specific IDs (Spotify, Apple Music, etc.)
// keyed back to the universal ISRC. Enables future cross-platform matching.
export const platformTrackIds = pgTable('platform_track_ids', {
  id:              uuid('id').primaryKey().defaultRandom(),
  isrc:            varchar('isrc', { length: 40 }).references(() => tracks.isrc).notNull(),
  platform:        varchar('platform', { length: 30 }).notNull(),
  platformTrackId: varchar('platform_track_id', { length: 100 }).notNull(),
}, (table) => [
  index('platform_lookup_idx').on(table.platform, table.platformTrackId),
  unique('isrc_platform_uniq').on(table.isrc, table.platform),
])

// ── Resonance Posts ─────────────────────────────────────────────────────────
export const resonancePosts = pgTable('resonance_posts', {
  id:             uuid('id').primaryKey().defaultRandom(),
  userId:         uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  isrc:           varchar('isrc', { length: 40 }).references(() => tracks.isrc).notNull(),
  momentStartMs:  integer('moment_start_ms').notNull(),
  momentEndMs:    integer('moment_end_ms'),          // null = point capture
  focusType:      focusTypeEnum('focus_type').notNull(),
  subLayer:       varchar('sub_layer', { length: 50 }),
  sensoryTags:    text('sensory_tags').array(),
  // Predefined tags validated at API layer. Custom tags allowed (max 30 chars).
  // Max 6 tags total per post.
  lyricText:      text('lyric_text'),                // set only on lyric-tap captures
  reflection:     text('reflection'),
  createdAt:      timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  // Powers the matching engine query (ISRC + time window range scan)
  index('track_moment_idx').on(table.isrc, table.momentStartMs),
  // Powers the self-discovery dashboard and "My Resonances" queries
  index('user_posts_idx').on(table.userId, table.createdAt),
])

// ── Post Matches ────────────────────────────────────────────────────────────
// Persisted match records. Enables async notifications and match count display.
// matchTier: 0 = exact (same ISRC + focusType + overlapping range)
//            1 = moment (same ISRC + overlapping range, different focusType)
export const postMatches = pgTable('post_matches', {
  id:        uuid('id').primaryKey().defaultRandom(),
  postAId:   uuid('post_a_id').references(() => resonancePosts.id, { onDelete: 'cascade' }).notNull(),
  postBId:   uuid('post_b_id').references(() => resonancePosts.id, { onDelete: 'cascade' }).notNull(),
  matchTier: integer('match_tier').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('post_matches_a_idx').on(table.postAId),
  index('post_matches_b_idx').on(table.postBId),
])

// ── Conversations ────────────────────────────────────────────────────────────
// One row per user pair, ever (enforced by user_pair_uniq). userAId/userBId
// are stored in canonical order (smaller UUID first) by the service layer so
// the unique constraint catches the pair regardless of who initiated.
// status: 'pending' (initiator sent opener, awaiting reply, no expiry) |
//         'active' (recipient replied — free messaging both ways)
export const conversations = pgTable('conversations', {
  id:            uuid('id').primaryKey().defaultRandom(),
  userAId:       uuid('user_a_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  userBId:       uuid('user_b_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  initiatorId:   uuid('initiator_id').references(() => users.id).notNull(),
  anchorMatchId: uuid('anchor_match_id').references(() => postMatches.id).notNull(),
  status:        varchar('status', { length: 20 }).notNull().default('pending'),
  ignoredAt:     timestamp('ignored_at'),          // soft-hide, recipient side only
  lastReadAtA:   timestamp('last_read_at_a'),
  lastReadAtB:   timestamp('last_read_at_b'),
  createdAt:     timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('conversations_user_a_idx').on(table.userAId),
  index('conversations_user_b_idx').on(table.userBId),
  unique('user_pair_uniq').on(table.userAId, table.userBId),
])

// ── Messages ─────────────────────────────────────────────────────────────────
export const messages = pgTable('messages', {
  id:             uuid('id').primaryKey().defaultRandom(),
  conversationId: uuid('conversation_id').references(() => conversations.id, { onDelete: 'cascade' }).notNull(),
  senderId:       uuid('sender_id').references(() => users.id).notNull(),
  body:           text('body').notNull(),
  createdAt:      timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('messages_conversation_idx').on(table.conversationId, table.createdAt),
])

// ── Conversation Anchors ─────────────────────────────────────────────────────
// Matches found between two users who already have a conversation. The
// conversation's own anchorMatchId covers the first match; this table covers
// every match found after that, appended to the same thread.
export const conversationAnchors = pgTable('conversation_anchors', {
  id:             uuid('id').primaryKey().defaultRandom(),
  conversationId: uuid('conversation_id').references(() => conversations.id, { onDelete: 'cascade' }).notNull(),
  matchId:        uuid('match_id').references(() => postMatches.id).notNull(),
  createdAt:      timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  unique('conversation_match_uniq').on(table.conversationId, table.matchId),
])

// ── Notifications ───────────────────────────────────────────────────────────
// In-app only (no email at MVP).
// types: 'new_match' | 'new_match_anchor' | 'conversation_request' | 'conversation_accepted'
// conversationId lets the bell route taps for chat-related types straight to
// the thread instead of the track view.
export const notifications = pgTable('notifications', {
  id:             uuid('id').primaryKey().defaultRandom(),
  userId:         uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  type:           varchar('type', { length: 50 }).notNull(),
  matchId:        uuid('match_id').references(() => postMatches.id),
  conversationId: uuid('conversation_id').references(() => conversations.id),
  read:           boolean('read').default(false).notNull(),
  createdAt:      timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('user_notif_idx').on(table.userId, table.read),
])
