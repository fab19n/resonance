// apps/web/src/components/StartConversationModal.tsx
//
// Opened from a match card. The matched moment IS the conversation starter —
// the user reacts to it rather than writing a cold opener. Stays in the
// player flow as a bottom sheet, same pattern as CaptureModal.

'use client'

import { useState, useEffect } from 'react'
import type { MatchResult } from '@resonance/shared'
import { FOCUS_TYPE_LABELS } from '@resonance/shared'
import { formatMoment } from '@/lib/format'

interface Props {
  match: MatchResult
  trackTitle: string
  onSent: (conversationId: string) => void
  onDismiss: () => void
}

export function StartConversationModal({ match, trackTitle, onSent, onDismiss }: Props) {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(id)
  }, [])

  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSend() {
    if (!body.trim()) return
    setSending(true)
    setError(null)

    const res = await fetch('/api/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ matchId: match.post.id, body: body.trim() }),
    })

    setSending(false)

    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string; existingConversationId?: string }
      if (data.existingConversationId) {
        // Race condition — a conversation appeared between opening this modal
        // and sending. Just route them there instead of erroring.
        onSent(data.existingConversationId)
        return
      }
      setError(data.error ?? 'Could not send. Please try again.')
      return
    }

    const conversation = (await res.json()) as { id: string }
    onSent(conversation.id)
  }

  return (
    <>
      <div
        onClick={onDismiss}
        className={[
          'fixed inset-0 z-40 bg-black/50 transition-opacity duration-300',
          visible ? 'opacity-100' : 'opacity-0',
        ].join(' ')}
      />
      <div
        className={[
          'fixed bottom-0 left-0 right-0 z-50 mx-auto max-w-md',
          'rounded-t-2xl bg-background shadow-2xl',
          'transition-transform duration-300 ease-out',
          visible ? 'translate-y-0' : 'translate-y-full',
        ].join(' ')}
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-border" />
        </div>

        <div className="space-y-4 px-5 pb-8 pt-2">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">Start a conversation</h2>
            <button type="button" onClick={onDismiss} className="text-xs text-muted hover:text-foreground">
              ✕
            </button>
          </div>

          {/* Matched moment context */}
          <div className="rounded-xl bg-accent/8 px-3.5 py-3">
            <p className="text-xs text-muted">You both captured</p>
            <p className="text-sm font-medium">{trackTitle}</p>
            <p className="mt-1 text-xs text-accent">
              {formatMoment(match.post.momentStartMs, match.post.momentEndMs)} ·{' '}
              {FOCUS_TYPE_LABELS[match.post.focusType]}
              {match.post.subLayer && ` · ${match.post.subLayer}`}
            </p>
          </div>

          <div className="space-y-1.5">
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={3}
              maxLength={2000}
              placeholder="React to what you both heard…"
              autoFocus
              className="w-full resize-none rounded-xl border border-border bg-card p-3 text-sm outline-none focus:border-accent"
            />
            <p className="text-xs text-muted/60">
              They'll see this alongside the match. If they reply, the conversation opens up.
            </p>
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <button
            type="button"
            onClick={() => void handleSend()}
            disabled={!body.trim() || sending}
            className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-accent px-6 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {sending ? 'Sending…' : 'Send'}
          </button>
        </div>
      </div>
    </>
  )
}
