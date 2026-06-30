// apps/web/src/components/MessageBubble.tsx

import type { MessageDTO } from '@resonance/shared'

function formatClockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

export function MessageBubble({ message, isMine }: { message: MessageDTO; isMine: boolean }) {
  return (
    <div className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
      <div
        className={[
          'max-w-[75%] rounded-2xl px-3.5 py-2 text-sm',
          isMine
            ? 'rounded-br-sm bg-accent text-accent-foreground'
            : 'rounded-bl-sm bg-card text-foreground',
        ].join(' ')}
      >
        <p className="whitespace-pre-wrap break-words">{message.body}</p>
        <p className={`mt-1 text-[10px] ${isMine ? 'text-accent-foreground/70' : 'text-muted'}`}>
          {formatClockTime(message.createdAt)}
        </p>
      </div>
    </div>
  )
}
