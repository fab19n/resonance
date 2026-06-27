// apps/web/src/db/schema.ts
import {
  pgTable, pgEnum, uuid, varchar, integer,
  text, timestamp, boolean, index, unique,
} from 'drizzle-orm/pg-core'

// Mirrors FOCUS_TYPES in @resonance/shared — same values, same order.
export const focusTypeEnum = pgEnum('focus_type', [
  'lyrics', 'beat', 'rhythm', 'production',
  'instrumentation', 'emotion', 'structure',
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
  isrc:       varchar('isrc', { length: 15 }).primaryKey(),
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
  isrc:            varchar('isrc', { length: 15 }).references(() => tracks.isrc).notNull(),
  platform:        varchar('platform', { length: 30 }).notNull(),
  platformTrackId: varchar('platform_track_id', { length: 100 }).notNull(),
}, (table) => [
  index('platform_lookup_idx').on(table.platform, table.platformTrackId),
  unique('isrc_platform_uniq').on(table.isrc, table.platform),
])

// ── Resonance Posts ─────────────────────────────────────────────────────────
export const resonancePosts = pgTable('resonance_posts', {
  id:          uuid('id').primaryKey().defaultRandom(),
  userId:      uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  isrc:        varchar('isrc', { length: 15 }).references(() => tracks.isrc).notNull(),
  progressMs:  integer('progress_ms').notNull(),
  focusType:   focusTypeEnum('focus_type').notNull(),
  sensoryTags: text('sensory_tags').array(),
  // Predefined tags validated at API layer. Custom tags allowed (max 30 chars).
  // Max 6 tags total per post.
  reflection:  text('reflection'),
  createdAt:   timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  // Powers the matching engine query (ISRC + time window range scan)
  index('track_moment_idx').on(table.isrc, table.progressMs),
  // Powers the self-discovery dashboard and "My Resonances" queries
  index('user_posts_idx').on(table.userId, table.createdAt),
])

// ── Post Matches ────────────────────────────────────────────────────────────
// Persisted match records. Enables async notifications and match count display.
// matchTier: 0 = exact (same ISRC + focusType + ±3000ms)
//            1 = moment (same ISRC + ±3000ms, different focusType)
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

// ── Notifications ───────────────────────────────────────────────────────────
// In-app only (no email at MVP). Currently one type: 'new_match'.
// Pioneer state: notification pre-created on zero-match posts, fired later.
export const notifications = pgTable('notifications', {
  id:        uuid('id').primaryKey().defaultRandom(),
  userId:    uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  type:      varchar('type', { length: 50 }).notNull(),
  matchId:   uuid('match_id').references(() => postMatches.id),
  read:      boolean('read').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('user_notif_idx').on(table.userId, table.read),
])
