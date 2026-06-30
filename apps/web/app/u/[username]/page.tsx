// apps/web/app/u/[username]/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { FOCUS_TYPE_LABELS, type FocusType, type PublicProfileResponse } from '@resonance/shared'
import { AppHeader } from '@/components/AppHeader'

export default function PublicProfilePage() {
  const params = useParams<{ username: string }>()
  const username = params.username

  const [profile, setProfile] = useState<PublicProfileResponse | null>(null)
  const [status, setStatus] = useState<'loading' | 'unauthed' | 'notfound' | 'ready'>('loading')

  useEffect(() => {
    let cancelled = false
    fetch(`/api/users/${encodeURIComponent(username)}`)
      .then((res) => {
        if (res.status === 401) {
          if (!cancelled) setStatus('unauthed')
          return null
        }
        if (!res.ok) {
          if (!cancelled) setStatus('notfound')
          return null
        }
        return res.json() as Promise<PublicProfileResponse>
      })
      .then((data) => {
        if (data && !cancelled) {
          setProfile(data)
          setStatus('ready')
        }
      })
      .catch(() => {
        if (!cancelled) setStatus('notfound')
      })
    return () => { cancelled = true }
  }, [username])

  return (
    <main className="mx-auto min-h-screen max-w-md px-6 py-10">
      <AppHeader />

      {status === 'loading' && <p className="text-muted">Loading…</p>}
      {status === 'unauthed' && (
        <a href="/login" className="text-accent hover:underline">Go to login →</a>
      )}
      {status === 'notfound' && <p className="text-muted">This listener couldn't be found.</p>}
      {status === 'ready' && profile && <PublicProfileBody profile={profile} />}
    </main>
  )
}

function PublicProfileBody({ profile }: { profile: PublicProfileResponse }) {
  const name = profile.user.displayName ?? profile.user.username

  // Sorted descending so the most prominent focus type renders first, full-width.
  const focusEntries = (Object.entries(profile.focusWeights) as [FocusType, number][]).sort(
    (a, b) => b[1] - a[1],
  )
  const hasActivity = focusEntries.length > 0 || profile.topArtists.length > 0

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        {profile.user.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={profile.user.avatarUrl} alt="" width={64} height={64} className="rounded-full" />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-border text-xl font-medium text-muted">
            {name.charAt(0).toUpperCase()}
          </div>
        )}
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{name}</h1>
          <p className="text-sm text-muted">@{profile.user.username}</p>
        </div>
      </div>

      {!hasActivity && <p className="text-muted">Hasn't captured a moment yet.</p>}

      {focusEntries.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold">Listens for</h2>
          <div className="space-y-2.5">
            {focusEntries.map(([focus, weight]) => (
              <div key={focus}>
                <p className="mb-1 text-xs text-foreground">{FOCUS_TYPE_LABELS[focus]}</p>
                <div className="h-2 w-full overflow-hidden rounded-full bg-border">
                  {/* Width is relative to this person's own top focus type —
                      never a raw count. Floor of 6% so the smallest bar still
                      reads as present rather than vanishing entirely. */}
                  <div
                    className="h-full rounded-full bg-accent"
                    style={{ width: `${Math.max(6, weight * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {profile.topArtists.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold">Artists they return to</h2>
          <div className="flex flex-wrap gap-2">
            {profile.topArtists.map((artist) => (
              <span
                key={artist}
                className="rounded-full border border-border px-3 py-1.5 text-sm"
              >
                {artist}
              </span>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
