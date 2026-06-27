// apps/web/app/api/auth/spotify/init/route.ts
import { NextResponse, type NextRequest } from 'next/server'
import {
  generateCodeVerifier,
  generateCodeChallenge,
  generateState,
  buildAuthorizeUrl,
} from '@/lib/spotify'

const AUTH_TX_COOKIE = 'spotify_auth'

export async function GET(_request: NextRequest) {
  const verifier = generateCodeVerifier()
  const challenge = generateCodeChallenge(verifier)
  const state = generateState()

  const res = NextResponse.redirect(buildAuthorizeUrl(challenge, state))

  // Stash the verifier + state for the callback to read. Short-lived, httpOnly.
  res.cookies.set(AUTH_TX_COOKIE, JSON.stringify({ verifier, state }), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 600, // 10 minutes
  })

  return res
}
