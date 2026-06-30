// apps/web/src/components/MessagesIcon.tsx
//
// Separate from NotificationsBell by design — relationship-level events
// (requests, accepts, new anchors) go through the bell; routine message
// traffic lives here, like Instagram splitting Activity from DMs.

'use client'

import { useCallback, useEffect, useState } from 'react'
import type { ConversationsListResponse } from '@resonance/shared'

export function MessagesIcon() {
  const [unread, setUnread] = useState(0)

  const load = useCallback(async () => {
    const res = await fetch('/api/conversations')
    if (!res.ok) return
    const data = (await res.json()) as ConversationsListResponse
    setUnread(data.conversations.reduce((sum, c) => sum + c.unreadCount, 0))
  }, [])

  useEffect(() => {
    void load()
    const id = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return
      void load()
    }, 30000)
    return () => clearInterval(id)
  }, [load])

  return (
    <a
      href="/messages"
      aria-label="Messages"
      className="relative inline-flex size-12 items-center justify-center rounded-full border border-border bg-card text-foreground transition-colors hover:border-accent"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
      {unread > 0 && (
        <span className="absolute right-2 top-2 min-w-4 rounded-full bg-accent px-1 text-center text-[10px] font-semibold leading-4 text-accent-foreground">
          {unread > 9 ? '9+' : unread}
        </span>
      )}
    </a>
  )
}
