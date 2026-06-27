// apps/web/src/lib/auth.ts
//
// Session = a signed JWT in an httpOnly cookie. This is the trusted verification
// layer (proxy.ts only checks cookie presence; the real signature check is here
// and is called by route handlers).

import { SignJWT, jwtVerify } from 'jose'
import type { NextRequest } from 'next/server'

export const SESSION_COOKIE = 'resonance_session'

export interface SessionPayload {
  userId: string
  spotifyId: string
}

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET is not set')
  return new TextEncoder().encode(secret)
}

export async function signSession(payload: SessionPayload): Promise<string> {
  const expiresIn = process.env.JWT_EXPIRES_IN
  if (!expiresIn) throw new Error('JWT_EXPIRES_IN is not set')

  return new SignJWT({ spotifyId: payload.spotifyId })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.userId)
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(getSecret())
}

/** Verify a raw token string. Throws if invalid/expired. */
export async function verifySession(token: string): Promise<SessionPayload> {
  const { payload } = await jwtVerify(token, getSecret())
  if (!payload.sub || typeof payload.spotifyId !== 'string') {
    throw new Error('Malformed session token')
  }
  return { userId: payload.sub, spotifyId: payload.spotifyId }
}

/** Read + verify the session from a request. Returns null when absent/invalid. */
export async function getSession(request: NextRequest): Promise<SessionPayload | null> {
  const token = request.cookies.get(SESSION_COOKIE)?.value
  if (!token) return null
  try {
    return await verifySession(token)
  } catch {
    return null
  }
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7 days
  }
}
