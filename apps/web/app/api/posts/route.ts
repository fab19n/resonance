// apps/web/app/api/posts/route.ts
import { NextResponse, type NextRequest } from 'next/server'
import {
  FOCUS_TYPES,
  ALL_PREDEFINED_TAGS,
  MAX_TAGS_PER_POST,
  MAX_CUSTOM_TAG_LENGTH,
  type CreateResonancePayload,
  type FocusType,
  type TrackSummary,
} from '@resonance/shared'
import { getAuthedUser } from '@/lib/requireUser'
import { createResonancePost } from '@/services/captureService'

const CUSTOM_TAG_RE = /^[a-z0-9-]+$/i

type ParseResult =
  | { ok: true; payload: CreateResonancePayload }
  | { ok: false; error: string }

function parseTrack(value: unknown): TrackSummary | null {
  if (typeof value !== 'object' || value === null) return null
  const o = value as Record<string, unknown>
  if (typeof o.isrc !== 'string' || o.isrc.length === 0) return null
  if (typeof o.title !== 'string') return null
  if (typeof o.artist !== 'string') return null
  if (typeof o.durationMs !== 'number') return null
  if (typeof o.spotifyTrackId !== 'string') return null
  return {
    isrc: o.isrc,
    title: o.title,
    artist: o.artist,
    albumName: typeof o.albumName === 'string' ? o.albumName : null,
    albumArt: typeof o.albumArt === 'string' ? o.albumArt : null,
    durationMs: o.durationMs,
    spotifyTrackId: o.spotifyTrackId,
  }
}

function parsePayload(body: unknown): ParseResult {
  if (typeof body !== 'object' || body === null) {
    return { ok: false, error: 'Body must be a JSON object' }
  }
  const b = body as Record<string, unknown>

  if (!FOCUS_TYPES.includes(b.focusType as FocusType)) {
    return { ok: false, error: `focusType must be one of: ${FOCUS_TYPES.join(', ')}` }
  }

  if (typeof b.progressMs !== 'number' || !Number.isInteger(b.progressMs) || b.progressMs < 0) {
    return { ok: false, error: 'progressMs must be a non-negative integer' }
  }

  if (!Array.isArray(b.sensoryTags)) {
    return { ok: false, error: 'sensoryTags must be an array' }
  }
  if (b.sensoryTags.length > MAX_TAGS_PER_POST) {
    return { ok: false, error: `A post may have at most ${MAX_TAGS_PER_POST} sensory tags` }
  }
  for (const tag of b.sensoryTags) {
    if (typeof tag !== 'string') {
      return { ok: false, error: 'Each sensory tag must be a string' }
    }
    const isPredefined = ALL_PREDEFINED_TAGS.includes(tag)
    const isValidCustom = tag.length <= MAX_CUSTOM_TAG_LENGTH && CUSTOM_TAG_RE.test(tag)
    if (!isPredefined && !isValidCustom) {
      return {
        ok: false,
        error: `Invalid tag "${tag}": must be predefined or ≤${MAX_CUSTOM_TAG_LENGTH} chars (letters, digits, hyphens)`,
      }
    }
  }

  if (b.reflection !== undefined && typeof b.reflection !== 'string') {
    return { ok: false, error: 'reflection must be a string when provided' }
  }

  const track = parseTrack(b.track)
  if (!track) {
    return {
      ok: false,
      error: 'track is required and must include isrc, title, artist, durationMs, spotifyTrackId',
    }
  }

  return {
    ok: true,
    payload: {
      track,
      progressMs: b.progressMs,
      focusType: b.focusType as FocusType,
      sensoryTags: b.sensoryTags as string[],
      reflection: b.reflection as string | undefined,
    },
  }
}

export async function POST(request: NextRequest) {
  const user = await getAuthedUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = parsePayload(body)
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }

  const result = await createResonancePost(user.id, parsed.payload)
  return NextResponse.json(result, { status: 201 })
}
