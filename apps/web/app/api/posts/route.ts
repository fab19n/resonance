// apps/web/app/api/posts/route.ts
import { NextResponse, type NextRequest } from 'next/server'
import {
  FOCUS_TYPES,
  ALL_PREDEFINED_TAGS,
  MAX_TAGS_PER_POST,
  MAX_CUSTOM_TAG_LENGTH,
  isValidSubLayer,
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

  // focusType
  if (!FOCUS_TYPES.includes(b.focusType as FocusType)) {
    return { ok: false, error: `focusType must be one of: ${FOCUS_TYPES.join(', ')}` }
  }
  const focusType = b.focusType as FocusType

  // momentStartMs (required)
  if (typeof b.momentStartMs !== 'number' || !Number.isInteger(b.momentStartMs) || b.momentStartMs < 0) {
    return { ok: false, error: 'momentStartMs must be a non-negative integer' }
  }

  // momentEndMs (optional — null or absent = point capture)
  let momentEndMs: number | null = null
  if (b.momentEndMs !== undefined && b.momentEndMs !== null) {
    if (typeof b.momentEndMs !== 'number' || !Number.isInteger(b.momentEndMs) || b.momentEndMs < 0) {
      return { ok: false, error: 'momentEndMs must be a non-negative integer when provided' }
    }
    if (b.momentEndMs <= b.momentStartMs) {
      return { ok: false, error: 'momentEndMs must be greater than momentStartMs' }
    }
    momentEndMs = b.momentEndMs
  }

  // subLayer (optional — must be valid for the chosen focusType when present)
  let subLayer: string | null = null
  if (b.subLayer !== undefined && b.subLayer !== null) {
    if (typeof b.subLayer !== 'string') {
      return { ok: false, error: 'subLayer must be a string when provided' }
    }
    if (!isValidSubLayer(focusType, b.subLayer)) {
      return { ok: false, error: `"${b.subLayer}" is not a valid sub-layer for focus type "${focusType}"` }
    }
    subLayer = b.subLayer
  }

  // sensoryTags
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

  // lyricText (optional)
  let lyricText: string | null = null
  if (b.lyricText !== undefined && b.lyricText !== null) {
    if (typeof b.lyricText !== 'string') {
      return { ok: false, error: 'lyricText must be a string when provided' }
    }
    lyricText = b.lyricText
  }

  // reflection (optional)
  if (b.reflection !== undefined && typeof b.reflection !== 'string') {
    return { ok: false, error: 'reflection must be a string when provided' }
  }

  // track
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
      momentStartMs: b.momentStartMs,
      momentEndMs,
      focusType,
      subLayer,
      sensoryTags: b.sensoryTags as string[],
      lyricText,
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
