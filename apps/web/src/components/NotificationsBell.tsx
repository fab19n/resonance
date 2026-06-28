// apps/web/src/components/NotificationsBell.tsx
'use client'

import { useCallback, useEffect, useState } from 'react'
import type { NotificationDTO, NotificationsResponse } from '@resonance/shared'

function notificationText(n: NotificationDTO): string {
  const track = n.trackTitle ? ` on “${n.trackTitle}”` : ''
  if (n.matchTier === 0) return `Exact resonance${track}`
  if (n.matchTier === 1) return `Same moment, different lens${track}`
  return `Someone resonated with your moment${track}`
}

export function NotificationsBell() {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<NotificationDTO[]>([])
  const [unread, setUnread] = useState(0)

  const load = useCallback(async () => {
    const res = await fetch('/api/notifications')
    if (!res.ok) return
    const data = (await res.json()) as NotificationsResponse
    setItems(data.notifications)
    setUnread(data.unreadCount)
  }, [])

  useEffect(() => {
    void load()
    const id = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return
      void load()
    }, 30000)
    return () => clearInterval(id)
  }, [load])

  async function markAllRead() {
    await fetch('/api/notifications/read-all', { method: 'POST' })
    setUnread(0)
    setItems((prev) => prev.map((n) => ({ ...n, read: true })))
  }

  async function openNotification(n: NotificationDTO) {
    if (!n.read) {
      await fetch(`/api/notifications/${n.id}/read`, { method: 'POST' })
      setUnread((u) => Math.max(0, u - 1))
    }
    if (n.isrc) {
      window.location.href = `/tracks/${encodeURIComponent(n.isrc)}`
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Notifications"
        className="relative inline-flex size-12 items-center justify-center rounded-full border border-border bg-card text-foreground transition-colors hover:border-accent"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute right-2 top-2 min-w-4 rounded-full bg-accent px-1 text-center text-[10px] font-semibold leading-4 text-accent-foreground">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          {/* click-away backdrop */}
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="absolute right-0 z-20 mt-2 w-80 overflow-hidden rounded-2xl border border-border bg-card shadow-lg">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <span className="text-sm font-semibold">Notifications</span>
              {unread > 0 && (
                <button type="button" onClick={markAllRead} className="text-xs text-accent hover:underline">
                  Mark all read
                </button>
              )}
            </div>
            <div className="max-h-96 overflow-y-auto">
              {items.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-muted">Nothing yet.</p>
              ) : (
                items.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => void openNotification(n)}
                    className="block w-full border-b border-border px-4 py-3 text-left transition-colors last:border-0 hover:bg-background"
                  >
                    <div className={n.read ? 'text-sm text-muted' : 'text-sm font-medium'}>
                      {notificationText(n)}
                    </div>
                    {n.trackArtist && (
                      <div className="mt-0.5 text-xs text-muted">{n.trackArtist}</div>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
