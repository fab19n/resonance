// apps/web/proxy.ts
//
// Next.js 16: this file was called `middleware.ts` up to Next.js 15. The file
// AND the exported function are renamed to `proxy`. It runs on the Node.js
// runtime and must live at the app root (same level as package.json).
//
// IMPORTANT (Next.js 16 guidance + CVE-2025-29927): the proxy layer is a
// network gatekeeper, not a trusted security boundary. Keep it to a cheap
// session-cookie *presence* check. Real cryptographic JWT verification happens
// inside the route handlers / a shared auth helper (src/lib/auth.ts, added in
// Milestone 2) where it can be trusted.

import { NextResponse, type NextRequest } from 'next/server'

const PROTECTED = ['/api/posts', '/api/spotify', '/api/profile', '/api/notifications']

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isProtected = PROTECTED.some((path) => pathname.startsWith(path))
  if (!isProtected) return NextResponse.next()

  const token = request.cookies.get('resonance_session')?.value
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Token present → let the request through. The route handler verifies the
  // JWT signature and loads the user. (Milestone 2.)
  return NextResponse.next()
}

export const config = {
  matcher: ['/api/:path*'],
}
