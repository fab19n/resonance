// apps/web/app/profile/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { FOCUS_TYPE_LABELS, type FocusType, type ProfileResponse } from '@resonance/shared'
import { AppHeader } from '@/components/AppHeader'

export default function ProfilePage() {
  const [profile, setProfile] = useState<ProfileResponse | null>(null)
  const [username, setUsername] = useState<string | null>(null)
  const [status, setStatus] = useState<'loading' | 'unauthed' | 'ready'>('loading')

  useEffect(() => {
    let cancelled = false
    fetch('/api/auth/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && !cancelled) setUsername(data.username)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false
    fetch('/api/profile/me')
      .then((res) => {
        if (!res.ok) {
          if (!cancelled) setStatus('unauthed')
          return null
        }
        return res.json() as Promise<ProfileResponse>
      })
      .then((data) => {
        if (data && !cancelled) {
          setProfile(data)
          setStatus('ready')
        }
      })
      .catch(() => {
        if (!cancelled) setStatus('unauthed')
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <main className="mx-auto min-h-screen max-w-md px-6 py-10">
      <AppHeader active="profile" />
      <h1 className="mb-1 text-2xl font-semibold tracking-tight">Listening Profile</h1>
      <p className="mb-2 text-sm text-muted">How you hear, building over time.</p>
      {username && (
        <a
          href={`/u/${username}`}
          className="mb-8 inline-block text-xs text-accent hover:underline"
        >
          View as others see you →
        </a>
      )}

      {status === 'loading' && <p className="text-muted">Loading…</p>}
      {status === 'unauthed' && (
        <a href="/login" className="text-accent hover:underline">
          Go to login →
        </a>
      )}
      {status === 'ready' && profile && <ProfileBody profile={profile} />}
    </main>
  )
}

function ProfileBody({ profile }: { profile: ProfileResponse }) {
  const { totalPosts, matchCount, focusTypeBreakdown, topArtists } = profile

  const focusEntries = (Object.entries(focusTypeBreakdown) as [FocusType, number][]).sort(
    (a, b) => b[1] - a[1],
  )
  const topFocus = focusEntries[0]
  const maxFocus = topFocus ? topFocus[1] : 0

  return (
    <div className="space-y-8">
      {/* Always available from post 1 */}
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Moments captured" value={totalPosts} />
        <Stat label="Resonances" value={matchCount} />
      </div>

      {/* 5+ posts: most-used focus type */}
      {totalPosts >= 5 && topFocus && (
        <section>
          <h2 className="mb-2 text-sm font-semibold">You listen most for</h2>
          <p className="text-2xl font-semibold text-accent">{FOCUS_TYPE_LABELS[topFocus[0]]}</p>
        </section>
      )}

      {/* 10+ posts: top artists */}
      {totalPosts >= 10 && topArtists.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold">Artists you capture most</h2>
          <ul className="space-y-2">
            {topArtists.map((a) => (
              <li key={a.artist} className="flex justify-between text-sm">
                <span className="truncate">{a.artist}</span>
                <span className="text-muted">{a.count}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 20+ posts: full perception matrix */}
      {totalPosts >= 20 && focusEntries.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold">Your perception matrix</h2>
          <div className="space-y-2">
            {focusEntries.map(([focus, n]) => (
              <div key={focus}>
                <div className="mb-1 flex justify-between text-xs">
                  <span>{FOCUS_TYPE_LABELS[focus]}</span>
                  <span className="text-muted">{n}</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-border">
                  <div
                    className="h-full rounded-full bg-accent"
                    style={{ width: `${maxFocus > 0 ? (n / maxFocus) * 100 : 0}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <NextUnlock totalPosts={totalPosts} />
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="text-3xl font-semibold tabular-nums">{value}</div>
      <div className="mt-1 text-xs text-muted">{label}</div>
    </div>
  )
}

function NextUnlock({ totalPosts }: { totalPosts: number }) {
  const tiers = [
    { at: 5, label: 'your most-used focus type' },
    { at: 10, label: 'the artists you capture most' },
    { at: 20, label: 'your full perception matrix' },
  ]
  const next = tiers.find((t) => totalPosts < t.at)
  if (!next) return null
  return (
    <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted">
      Capture {next.at - totalPosts} more to unlock {next.label}.
    </p>
  )
}
