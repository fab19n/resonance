// apps/web/app/api/auth/spotify/callback/route.ts
import { NextResponse, type NextRequest } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { users } from '@/db/schema'
import { signSession, SESSION_COOKIE, sessionCookieOptions } from '@/lib/auth'
import { exchangeCodeForTokens, fetchSpotifyProfile } from '@/lib/spotify'

const AUTH_TX_COOKIE = 'spotify_auth'

// Always use NEXT_PUBLIC_APP_URL for redirects — never request.url.
// request.url resolves to localhost on the server even when the browser
// accessed via 127.0.0.1, which causes the session cookie (set on 127.0.0.1)
// to be invisible on the localhost page the browser lands on.
function appUrl(): string {
  const url = process.env.NEXT_PUBLIC_APP_URL
  if (!url) throw new Error('NEXT_PUBLIC_APP_URL is not set')
  return url
}

function loginRedirect(error: string) {
  const url = new URL('/login', appUrl())
  url.searchParams.set('error', error)
  return NextResponse.redirect(url)
}

function slugify(name: string | null): string {
  const base = (name ?? '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 40)
  return base || 'listener'
}

async function generateUniqueUsername(name: string | null): Promise<string> {
  const base = slugify(name)
  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate =
      attempt === 0 ? base : `${base}_${Math.floor(1000 + Math.random() * 9000)}`
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, candidate))
      .limit(1)
    if (!existing) return candidate
  }
  throw new Error('Could not generate a unique username')
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const code = params.get('code')
  const state = params.get('state')
  const error = params.get('error')

  if (error) return loginRedirect(error)
  if (!code || !state) return loginRedirect('missing_code')

  // Verify the PKCE transaction cookie.
  const txRaw = request.cookies.get(AUTH_TX_COOKIE)?.value
  if (!txRaw) return loginRedirect('missing_verifier')

  const tx = JSON.parse(txRaw) as { verifier: string; state: string }
  if (tx.state !== state) return loginRedirect('state_mismatch')

  // Exchange the authorization code for tokens.
  const tokens = await exchangeCodeForTokens(code, tx.verifier)
  if (!tokens.refresh_token) {
    throw new Error('Spotify did not return a refresh token')
  }
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000)

  // Fetch the Spotify profile to identify / create the user.
  const profile = await fetchSpotifyProfile(tokens.access_token)

  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.spotifyId, profile.id))
    .limit(1)

  let userId: string
  if (existing) {
    await db
      .update(users)
      .set({
        spotifyAccessToken: tokens.access_token,
        spotifyRefreshToken: tokens.refresh_token,
        spotifyTokenExpiresAt: expiresAt,
      })
      .where(eq(users.id, existing.id))
    userId = existing.id
  } else {
    const username = await generateUniqueUsername(profile.display_name)
    const [created] = await db
      .insert(users)
      .values({
        username,
        displayName: profile.display_name,
        avatarUrl: profile.images[0]?.url ?? null,
        email: profile.email,
        spotifyId: profile.id,
        spotifyAccessToken: tokens.access_token,
        spotifyRefreshToken: tokens.refresh_token,
        spotifyTokenExpiresAt: expiresAt,
      })
      .returning({ id: users.id })
    if (!created) throw new Error('Failed to create user')
    userId = created.id
  }

  // Issue the session cookie and clear the PKCE transaction cookie.
  // Redirect to NEXT_PUBLIC_APP_URL/home — never request.url — so the
  // browser stays on the same origin the cookie was issued for.
  const token = await signSession({ userId, spotifyId: profile.id })
  const res = NextResponse.redirect(new URL('/home', appUrl()))
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions())
  res.cookies.delete(AUTH_TX_COOKIE)
  return res
}
