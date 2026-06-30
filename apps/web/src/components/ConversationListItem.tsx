// apps/web/src/components/ConversationListItem.tsx

import type { ConversationSummaryDTO } from '@resonance/shared'

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diffMs / 60_000)
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d`
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function ConversationListItem({ convo }: { convo: ConversationSummaryDTO }) {
  const name = convo.otherUser.displayName ?? convo.otherUser.username
  const isPendingAwaitingThem = convo.status === 'pending' && convo.isInitiator
  const isPendingAwaitingMe = convo.status === 'pending' && !convo.isInitiator

  const preview = isPendingAwaitingThem
    ? 'Waiting for a reply'
    : isPendingAwaitingMe
      ? 'Wants to connect — tap to reply'
      : (convo.lastMessage?.body ?? 'Say something')

  return (
    <a
      href={`/messages/${convo.id}`}
      className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5 transition-colors hover:border-accent"
    >
      {convo.otherUser.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={convo.otherUser.avatarUrl} alt="" width={44} height={44} className="shrink-0 rounded-full" />
      ) : (
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-border text-sm font-medium text-muted">
          {name.charAt(0).toUpperCase()}
        </div>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-semibold">{name}</p>
          {convo.lastMessage && (
            <span className="shrink-0 text-xs text-muted">{timeAgo(convo.lastMessage.createdAt)}</span>
          )}
        </div>
        <p
          className={[
            'truncate text-xs',
            isPendingAwaitingMe ? 'font-medium text-accent' : 'text-muted',
          ].join(' ')}
        >
          {preview}
        </p>
      </div>

      {convo.unreadCount > 0 && (
        <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-accent-foreground">
          {convo.unreadCount}
        </span>
      )}
    </a>
  )
}
