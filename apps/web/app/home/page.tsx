// apps/web/app/home/page.tsx
'use client'

import { useEffect, useState } from 'react'
import type { CurrentUser, NowPlayingResponse } from '@resonance/shared'

export default function HomePage() {
  const [user, setUser] = useState<CurrentUser | null>(null)
  const [nowPlaying, setNowPlaying] = useState<NowPlayingResponse | null>(null)
  const [status, setStatus] = useState<'loading' | 'unauthed' | 'ready'>('loading')

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const meRes = await fetch('/api/auth/me')

        // Any non-200 response (401, 404, 500) → treat as unauthenticated.
        // 404 can appear on the first cold-start request before Turbopack
        // has compiled the route; 401 is the normal unauthenticated state.
        if (!meRes.ok) {
          if (!cancelled) setStatus('unauthed')
          return
        }

        const me = (await meRes.json()) as CurrentUser

        const npRes = await fetch('/api/spotify/now-playing')
        const np = npRes.ok
          ? ((await npRes.json()) as NowPlayingResponse)
          : { isPlaying: false, progressMs: null, track: null }

        if (!cancelled) {
          setUser(me)
          setNowPlaying(np)
          setStatus('ready')
        }
      } catch {
        // Network error or JSON parse failure — treat as unauthenticated.
        if (!cancelled) setStatus('unauthed')
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  const wrap = { fontFamily: 'system-ui', padding: '3rem', maxWidth: 480, margin: '0 auto' }

  if (status === 'loading') {
    return <main style={wrap}>Loading…</main>
  }

  if (status === 'unauthed') {
    return (
      <main style={wrap}>
        <p>You are not signed in.</p>
        <a href="/login">Go to login →</a>
      </main>
    )
  }

  return (
    <main style={wrap}>
      <p style={{ color: '#555' }}>Signed in as {user?.username}</p>

      {nowPlaying?.track ? (
        <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', alignItems: 'center' }}>
          {nowPlaying.track.albumArt && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={nowPlaying.track.albumArt}
              alt=""
              width={80}
              height={80}
              style={{ borderRadius: 8 }}
            />
          )}
          <div>
            <div style={{ fontWeight: 600 }}>{nowPlaying.track.title}</div>
            <div style={{ color: '#555' }}>{nowPlaying.track.artist}</div>
            <div style={{ color: '#999', fontSize: 13, marginTop: 4 }}>
              {nowPlaying.isPlaying ? '▶ Playing' : '⏸ Paused'} ·{' '}
              {Math.floor((nowPlaying.progressMs ?? 0) / 1000)}s in · ISRC {nowPlaying.track.isrc}
            </div>
          </div>
        </div>
      ) : (
        <p style={{ marginTop: '1.5rem' }}>
          Nothing playing right now. Start a track on any Spotify device and refresh.
        </p>
      )}
    </main>
  )
}