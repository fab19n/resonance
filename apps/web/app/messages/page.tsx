// apps/web/app/messages/page.tsx
'use client'

import { useEffect, useState } from 'react'
import type { ConversationSummaryDTO, ConversationsListResponse } from '@resonance/shared'
import { AppHeader } from '@/components/AppHeader'
import { ConversationListItem } from '@/components/ConversationListItem'

export default function MessagesPage() {
  const [conversations, setConversations] = useState<ConversationSummaryDTO[]>([])
  const [status, setStatus] = useState<'loading' | 'unauthed' | 'ready'>('loading')

  useEffect(() => {
    let cancelled = false
    fetch('/api/conversations')
      .then((res) => {
        if (!res.ok) {
          if (!cancelled) setStatus('unauthed')
          return null
        }
        return res.json() as Promise<ConversationsListResponse>
      })
      .then((data) => {
        if (data && !cancelled) {
          setConversations(data.conversations)
          setStatus('ready')
        }
      })
      .catch(() => {
        if (!cancelled) setStatus('unauthed')
      })
    return () => { cancelled = true }
  }, [])

  // Requests needing my reply float to the top, then active threads,
  // then my own pending sends waiting on the other person.
  const needsMyReply = conversations.filter((c) => c.status === 'pending' && !c.isInitiator)
  const active = conversations.filter((c) => c.status === 'active')
  const waitingOnThem = conversations.filter((c) => c.status === 'pending' && c.isInitiator)

  return (
    <main className="mx-auto min-h-screen max-w-md px-6 py-10">
      <AppHeader />
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Messages</h1>

      {status === 'loading' && <p className="text-muted">Loading…</p>}
      {status === 'unauthed' && (
        <a href="/login" className="text-accent hover:underline">
          Go to login →
        </a>
      )}

      {status === 'ready' && conversations.length === 0 && (
        <p className="text-muted">
          No conversations yet. When you and someone else resonate on the same moment, either of
          you can start one.
        </p>
      )}

      {status === 'ready' && conversations.length > 0 && (
        <div className="space-y-7">
          {needsMyReply.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">
                Requests
              </h2>
              <div className="space-y-2">
                {needsMyReply.map((c) => (
                  <ConversationListItem key={c.id} convo={c} />
                ))}
              </div>
            </section>
          )}

          {active.length > 0 && (
            <section className="space-y-2">
              {needsMyReply.length > 0 && (
                <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Conversations
                </h2>
              )}
              <div className="space-y-2">
                {active.map((c) => (
                  <ConversationListItem key={c.id} convo={c} />
                ))}
              </div>
            </section>
          )}

          {waitingOnThem.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">
                Sent
              </h2>
              <div className="space-y-2">
                {waitingOnThem.map((c) => (
                  <ConversationListItem key={c.id} convo={c} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </main>
  )
}
