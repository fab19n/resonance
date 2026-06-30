// apps/web/app/messages/[id]/page.tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import type { ConversationDetailDTO, MessageDTO } from '@resonance/shared'
import { AnchorCard } from '@/components/AnchorCard'
import { MessageBubble } from '@/components/MessageBubble'

type TimelineItem =
  | { kind: 'anchor'; createdAt: string; data: ConversationDetailDTO['anchors'][number] }
  | { kind: 'message'; createdAt: string; data: MessageDTO }

export default function ConversationThreadPage() {
  const params = useParams<{ id: string }>()
  const conversationId = params.id

  const [detail, setDetail] = useState<ConversationDetailDTO | null>(null)
  const [status, setStatus] = useState<'loading' | 'unauthed' | 'notfound' | 'ready'>('loading')
  const [meId, setMeId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  async function load() {
    const meRes = await fetch('/api/auth/me')
    if (!meRes.ok) {
      setStatus('unauthed')
      return
    }
    const me = (await meRes.json()) as { id: string }
    setMeId(me.id)

    const res = await fetch(`/api/conversations/${conversationId}`)
    if (res.status === 404 || res.status === 403) {
      setStatus('notfound')
      return
    }
    if (!res.ok) {
      setStatus('unauthed')
      return
    }
    const data = (await res.json()) as ConversationDetailDTO
    setDetail(data)
    setStatus('ready')
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [detail?.messages.length])

  async function send() {
    if (!draft.trim() || !detail) return
    setSending(true)
    const res = await fetch(`/api/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: draft.trim() }),
    })
    setSending(false)
    if (!res.ok) return

    const message = (await res.json()) as MessageDTO
    setDraft('')
    setDetail((prev) =>
      prev
        ? {
            ...prev,
            status: 'active',
            messages: [...prev.messages, message],
          }
        : prev,
    )
  }

  async function ignore() {
    await fetch(`/api/conversations/${conversationId}/ignore`, { method: 'POST' })
    window.location.href = '/messages'
  }

  if (status === 'loading') {
    return (
      <main className="mx-auto flex min-h-screen max-w-md items-center justify-center px-6">
        <p className="text-muted">Loading…</p>
      </main>
    )
  }
  if (status === 'unauthed') {
    return (
      <main className="mx-auto min-h-screen max-w-md px-6 py-10">
        <a href="/login" className="text-accent hover:underline">Go to login →</a>
      </main>
    )
  }
  if (status === 'notfound' || !detail) {
    return (
      <main className="mx-auto min-h-screen max-w-md px-6 py-10">
        <a href="/messages" className="text-xs text-accent hover:underline">← Back</a>
        <p className="mt-4 text-muted">Conversation not found.</p>
      </main>
    )
  }

  const name = detail.otherUser.displayName ?? detail.otherUser.username
  const isPendingForMe = detail.status === 'pending' && !detail.isInitiator
  const isPendingForThem = detail.status === 'pending' && detail.isInitiator

  // Interleave anchors and messages chronologically.
  const timeline: TimelineItem[] = [
    ...detail.anchors.map((a): TimelineItem => ({ kind: 'anchor', createdAt: a.createdAt, data: a })),
    ...detail.messages.map((m): TimelineItem => ({ kind: 'message', createdAt: m.createdAt, data: m })),
  ].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col px-6 py-6">
      {/* Header */}
      <div className="mb-4 flex items-center gap-3 border-b border-border pb-4">
        <a href="/messages" className="text-muted hover:text-foreground" aria-label="Back">
          ←
        </a>
        <a
          href={`/u/${detail.otherUser.username}`}
          className="flex items-center gap-3 hover:opacity-80"
        >
          {detail.otherUser.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={detail.otherUser.avatarUrl} alt="" width={36} height={36} className="rounded-full" />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-border text-sm font-medium text-muted">
              {name.charAt(0).toUpperCase()}
            </div>
          )}
          <p className="font-semibold">{name}</p>
        </a>
      </div>

      {/* Timeline */}
      <div className="flex-1 space-y-3 overflow-y-auto pb-4">
        {timeline.map((item, i) =>
          item.kind === 'anchor' ? (
            <AnchorCard key={`anchor-${item.data.id}-${i}`} anchor={item.data.anchor} />
          ) : (
            <MessageBubble key={item.data.id} message={item.data} isMine={item.data.senderId === meId} />
          ),
        )}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      {isPendingForMe && (
        <div className="space-y-2 border-t border-border pt-4">
          <p className="text-xs text-muted">
            Reply to start the conversation, or dismiss this request.
          </p>
          <div className="flex gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void send() }}
              placeholder="Write a reply…"
              maxLength={2000}
              className="min-h-12 flex-1 rounded-xl border border-border bg-card px-4 text-sm outline-none focus:border-accent"
            />
            <button
              type="button"
              onClick={() => void send()}
              disabled={!draft.trim() || sending}
              className="min-h-12 rounded-xl bg-accent px-5 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              Reply
            </button>
          </div>
          <button
            type="button"
            onClick={() => void ignore()}
            className="text-xs text-muted hover:text-foreground"
          >
            Dismiss
          </button>
        </div>
      )}

      {isPendingForThem && (
        <p className="border-t border-border pt-4 text-center text-xs text-muted">
          Waiting for {name} to reply.
        </p>
      )}

      {detail.status === 'active' && (
        <div className="flex gap-2 border-t border-border pt-4">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void send() }}
            placeholder="Message…"
            maxLength={2000}
            className="min-h-12 flex-1 rounded-xl border border-border bg-card px-4 text-sm outline-none focus:border-accent"
          />
          <button
            type="button"
            onClick={() => void send()}
            disabled={!draft.trim() || sending}
            className="min-h-12 rounded-xl bg-accent px-5 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            Send
          </button>
        </div>
      )}
    </main>
  )
}
