// apps/web/app/api/tracks/[isrc]/moments/route.ts
import { NextResponse, type NextRequest } from 'next/server'
import { asc, eq } from 'drizzle-orm'
import { TOLERANCE_WINDOW_MS, type TrackMomentsResponse, type MomentCluster } from '@resonance/shared'
import { db } from '@/db'
import { resonancePosts, tracks } from '@/db/schema'
import { getAuthedUser } from '@/lib/requireUser'
import { postToDTO } from '@/lib/mappers'

type PostRow = typeof resonancePosts.$inferSelect

function finalize(group: PostRow[]): MomentCluster {
  // centerMs is the mean of all momentStartMs values in the cluster.
  // For range captures, momentStartMs is the anchor — consistent for clustering.
  const centerMs = Math.round(
    group.reduce((sum, p) => sum + p.momentStartMs, 0) / group.length,
  )
  return { centerMs, posts: group.map(postToDTO) }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ isrc: string }> },
) {
  const user = await getAuthedUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { isrc } = await params

  const [track] = await db.select().from(tracks).where(eq(tracks.isrc, isrc)).limit(1)
  if (!track) {
    return NextResponse.json({ error: 'Track not found' }, { status: 404 })
  }

  const posts = await db
    .select()
    .from(resonancePosts)
    .where(eq(resonancePosts.isrc, isrc))
    .orderBy(asc(resonancePosts.momentStartMs))

  // Greedy clustering: walk posts in time order, keep them in the current
  // cluster while they fall within the tolerance window of its start, then
  // open a new cluster.
  const clusters: MomentCluster[] = []
  let current: PostRow[] = []
  let windowStart = 0

  for (const post of posts) {
    if (current.length === 0) {
      current = [post]
      windowStart = post.momentStartMs
      continue
    }
    if (post.momentStartMs - windowStart <= TOLERANCE_WINDOW_MS) {
      current.push(post)
    } else {
      clusters.push(finalize(current))
      current = [post]
      windowStart = post.momentStartMs
    }
  }
  if (current.length > 0) clusters.push(finalize(current))

  // Shared moments (2+ posts) first, then solo "unclaimed" ones.
  clusters.sort((a, b) => b.posts.length - a.posts.length || a.centerMs - b.centerMs)

  const body: TrackMomentsResponse = {
    track: {
      isrc: track.isrc,
      title: track.title,
      artist: track.artist,
      albumArt: track.albumArt,
      durationMs: track.durationMs,
    },
    clusters,
  }
  return NextResponse.json(body)
}
