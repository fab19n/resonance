// apps/web/src/lib/spotify.ts
// Phase 1 version + resumePlayback + pausePlayback
// All Spotify Web API interaction. PKCE flow (no client secret).

import { createHash, randomBytes } from 'node:crypto'
import { eq } from 'drizzle-orm'
import type { TrackSummary } from '@resonance/shared'
import { db } from '@/db'
import { users } from '@/db/schema'

const AUTH_BASE = 'https://accounts.spotify.com'
const API_BASE = 'https://api.spotify.com/v1'

type DbUser = typeof users.$inferSelect

function clientId(): string {
  const id = process.env.SPOTIFY_CLIENT_ID
  if (!id) throw new Error('SPOTIFY_CLIENT_ID is not set')
  return id
}

function redirectUri(): string {
  const uri = process.env.SPOTIFY_REDIRECT_URI
  if (!uri) throw new Error('SPOTIFY_REDIRECT_URI is not set')
  return uri
}

function scopes(): string {
  const s = process.env.SPOTIFY_SCOPES
  if (!s) throw new Error('SPOTIFY_SCOPES is not set')
  return s
}

// ── PKCE ────────────────────────────────────────────────────────────────────

export function generateCodeVerifier(): string {
  return randomBytes(64).toString('base64url')
}

export function generateCodeChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url')
}

export function generateState(): string {
  return randomBytes(16).toString('hex')
}

export function buildAuthorizeUrl(codeChallenge: string, state: string): string {
  const url = new URL(`${AUTH_BASE}/authorize`)
  url.search = new URLSearchParams({
    response_type: 'code',
    client_id: clientId(),
    scope: scopes(),
    redirect_uri: redirectUri(),
    state,
    code_challenge_method: 'S256',
    code_challenge: codeChallenge,
  }).toString()
  return url.toString()
}

// ── Token endpoints ──────────────────────────────────────────────────────────

interface SpotifyTokenResponse {
  access_token: string
  token_type: string
  scope: string
  expires_in: number
  refresh_token?: string
}

export async function exchangeCodeForTokens(
  code: string,
  codeVerifier: string,
): Promise<SpotifyTokenResponse> {
  const res = await fetch(`${AUTH_BASE}/api/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri(),
      client_id: clientId(),
      code_verifier: codeVerifier,
    }),
  })
  if (!res.ok) {
    throw new Error(`Spotify token exchange failed: ${res.status} ${await res.text()}`)
  }
  return res.json() as Promise<SpotifyTokenResponse>
}

async function refreshAccessToken(refreshToken: string): Promise<SpotifyTokenResponse> {
  const res = await fetch(`${AUTH_BASE}/api/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId(),
    }),
  })
  if (!res.ok) {
    throw new Error(`Spotify token refresh failed: ${res.status} ${await res.text()}`)
  }
  return res.json() as Promise<SpotifyTokenResponse>
}

export async function getValidAccessToken(user: DbUser): Promise<string> {
  const expiresAt = user.spotifyTokenExpiresAt.getTime()
  if (Date.now() < expiresAt - 60_000) {
    return user.spotifyAccessToken
  }

  const refreshed = await refreshAccessToken(user.spotifyRefreshToken)
  const newExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000)

  await db
    .update(users)
    .set({
      spotifyAccessToken: refreshed.access_token,
      spotifyTokenExpiresAt: newExpiresAt,
      ...(refreshed.refresh_token ? { spotifyRefreshToken: refreshed.refresh_token } : {}),
    })
    .where(eq(users.id, user.id))

  return refreshed.access_token
}

// ── Profile ──────────────────────────────────────────────────────────────────

export interface SpotifyProfile {
  id: string
  display_name: string | null
  email: string | null
  images: { url: string }[]
}

export async function fetchSpotifyProfile(accessToken: string): Promise<SpotifyProfile> {
  const res = await fetch(`${API_BASE}/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) {
    throw new Error(`Spotify profile fetch failed: ${res.status} ${await res.text()}`)
  }
  return res.json() as Promise<SpotifyProfile>
}

// ── Track mapping ────────────────────────────────────────────────────────────

interface SpotifyTrackItem {
  id: string
  name: string
  duration_ms: number
  external_ids?: { isrc?: string }
  artists: { name: string }[]
  album: { name: string; images: { url: string }[] }
}

function mapTrack(item: SpotifyTrackItem): TrackSummary {
  const isrc = item.external_ids?.isrc ?? `spotify:${item.id}`
  return {
    isrc,
    title: item.name,
    artist: item.artists.map((a) => a.name).join(', '),
    albumName: item.album.name ?? null,
    albumArt: item.album.images[0]?.url ?? null,
    durationMs: item.duration_ms,
    spotifyTrackId: item.id,
  }
}

// ── Player + Search ──────────────────────────────────────────────────────────

export interface NowPlaying {
  isPlaying: boolean
  progressMs: number | null
  track: TrackSummary | null
}

export async function getCurrentlyPlaying(accessToken: string): Promise<NowPlaying> {
  const res = await fetch(`${API_BASE}/me/player/currently-playing`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (res.status === 204) {
    return { isPlaying: false, progressMs: null, track: null }
  }
  if (!res.ok) {
    throw new Error(`Spotify now-playing failed: ${res.status} ${await res.text()}`)
  }

  const data = (await res.json()) as {
    is_playing: boolean
    progress_ms: number | null
    item: SpotifyTrackItem | null
  }

  if (!data.item) {
    return { isPlaying: false, progressMs: null, track: null }
  }

  return {
    isPlaying: data.is_playing,
    progressMs: data.progress_ms,
    track: mapTrack(data.item),
  }
}

export async function searchTracks(accessToken: string, query: string): Promise<TrackSummary[]> {
  const url = new URL(`${API_BASE}/search`)
  url.search = new URLSearchParams({ q: query, type: 'track', limit: '5' }).toString()

  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
  if (!res.ok) {
    throw new Error(`Spotify search failed: ${res.status} ${await res.text()}`)
  }

  const data = (await res.json()) as { tracks: { items: SpotifyTrackItem[] } }
  return data.tracks.items.map(mapTrack)
}

/**
 * Seeks Spotify playback to a specific position.
 * Requires user-modify-playback-state scope.
 */
export async function seekToPosition(accessToken: string, positionMs: number): Promise<void> {
  const url = new URL(`${API_BASE}/me/player/seek`)
  url.search = new URLSearchParams({ position_ms: String(positionMs) }).toString()

  const res = await fetch(url, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!res.ok && res.status !== 204) {
    throw new Error(`Spotify seek failed: ${res.status} ${await res.text()}`)
  }
}

/**
 * Resumes Spotify playback on the active device.
 * Requires user-modify-playback-state scope.
 */
export async function resumePlayback(accessToken: string): Promise<void> {
  const res = await fetch(`${API_BASE}/me/player/play`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!res.ok && res.status !== 204) {
    throw new Error(`Spotify play failed: ${res.status} ${await res.text()}`)
  }
}

/**
 * Pauses Spotify playback on the active device.
 * Requires user-modify-playback-state scope.
 */
export async function pausePlayback(accessToken: string): Promise<void> {
  const res = await fetch(`${API_BASE}/me/player/pause`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!res.ok && res.status !== 204) {
    throw new Error(`Spotify pause failed: ${res.status} ${await res.text()}`)
  }
}

export async function nextTrack(accessToken: string): Promise<void> {
  const res = await fetch(`${API_BASE}/me/player/next`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok && res.status !== 204) {
    throw new Error(`Spotify next failed: ${res.status} ${await res.text()}`)
  }
}

export async function previousTrack(accessToken: string): Promise<void> {
  const res = await fetch(`${API_BASE}/me/player/previous`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok && res.status !== 204) {
    throw new Error(`Spotify previous failed: ${res.status} ${await res.text()}`)
  }
}
