// apps/web/app/api/notifications/route.ts
import { NextResponse, type NextRequest } from 'next/server'
import { and, count, desc, eq } from 'drizzle-orm'
import type { NotificationsResponse, NotificationDTO, MatchTier } from '@resonance/shared'
import { db } from '@/db'
import { notifications, postMatches, resonancePosts, tracks } from '@/db/schema'
import { getAuthedUser } from '@/lib/requireUser'

const LIMIT = 20

export async function GET(request: NextRequest) {
  const user = await getAuthedUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Recent notifications (read + unread) for the bell, enriched with the track
  // of the user's matched post and the match tier. The notification's matchId
  // points at a post_matches row whose postBId is the user's (earlier) post.
  const rows = await db
    .select({
      id: notifications.id,
      type: notifications.type,
      read: notifications.read,
      createdAt: notifications.createdAt,
      matchTier: postMatches.matchTier,
      trackTitle: tracks.title,
      trackArtist: tracks.artist,
      isrc: tracks.isrc,
    })
    .from(notifications)
    .leftJoin(postMatches, eq(postMatches.id, notifications.matchId))
    .leftJoin(resonancePosts, eq(resonancePosts.id, postMatches.postBId))
    .leftJoin(tracks, eq(tracks.isrc, resonancePosts.isrc))
    .where(eq(notifications.userId, user.id))
    .orderBy(desc(notifications.createdAt))
    .limit(LIMIT)

  const [unread] = await db
    .select({ n: count() })
    .from(notifications)
    .where(and(eq(notifications.userId, user.id), eq(notifications.read, false)))

  const body: NotificationsResponse = {
    notifications: rows.map(
      (r): NotificationDTO => ({
        id: r.id,
        type: r.type,
        read: r.read,
        createdAt: r.createdAt.toISOString(),
        matchTier: (r.matchTier ?? null) as MatchTier | null,
        trackTitle: r.trackTitle ?? null,
        trackArtist: r.trackArtist ?? null,
        isrc: r.isrc ?? null,
      }),
    ),
    unreadCount: Number(unread?.n ?? 0),
  }
  return NextResponse.json(body)
}
