// apps/web/src/components/PostCard.tsx
//
// Shared card for displaying a resonance post across all surfaces:
//   - My Resonances list
//   - Track View clusters
//   - Match Response (after capture)
//
// Adapts to context via optional props (track info, match count, ownership).

'use client'

import { FOCUS_TYPE_LABELS, type ResonancePostDTO } from '@resonance/shared'
import { formatMoment } from '@/lib/format'

interface TrackInfo {
  title: string
  artist: string
  albumArt: string | null
}

interface Props {
  post: ResonancePostDTO
  track?: TrackInfo         // shown when card is inside a list (My Resonances)
  matchCount?: number       // shown in My Resonances
  isOwn?: boolean           // true = "You", false = "Another listener"
  href?: string             // wraps card in a link when provided
}


export function PostCard({ post, track, matchCount, isOwn, href }: Props) {
  const momentLabel = formatMoment(post.momentStartMs, post.momentEndMs)

  const inner = (
    <div className="space-y-3 rounded-2xl border border-border bg-card p-4 transition-colors">
      {/* Track info row — only shown when provided */}
      {track && (
        <div className="flex items-center gap-3">
          {track.albumArt ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={track.albumArt}
              alt=""
              width={48}
              height={48}
              className="shrink-0 rounded-lg"
            />
          ) : (
            <div className="h-12 w-12 shrink-0 rounded-lg bg-border" />
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{track.title}</p>
            <p className="truncate text-xs text-muted">{track.artist}</p>
          </div>
          {typeof matchCount === 'number' && (
            <div className="ml-auto shrink-0 text-right">
              <p className="text-sm font-semibold">{matchCount}</p>
              <p className="text-xs text-muted">
                {matchCount === 1 ? 'match' : 'matches'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Moment timestamp */}
      <p className="text-xs font-medium text-accent tabular-nums">{momentLabel}</p>

      {/* Layer + sub-layer */}
      <div className="flex items-center gap-1.5">
        <span className="text-sm font-medium">
          {FOCUS_TYPE_LABELS[post.focusType]}
        </span>
        {post.subLayer && (
          <>
            <span className="text-muted/40">·</span>
            <span className="text-sm text-muted">{post.subLayer}</span>
          </>
        )}
      </div>

      {/* Lyric text — only for lyrics captures */}
      {post.lyricText && (
        <p className="rounded-lg bg-accent/8 px-3 py-1.5 text-sm italic text-foreground/75">
          "{post.lyricText}"
        </p>
      )}

      {/* Sensory tags */}
      {post.sensoryTags && post.sensoryTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {post.sensoryTags.map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-border px-2 py-0.5 text-xs text-muted"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Reflection */}
      {post.reflection && (
        <p className="text-sm text-foreground/80">"{post.reflection}"</p>
      )}

      {/* Footer: ownership / match count without track */}
      {(isOwn !== undefined || (typeof matchCount === 'number' && !track)) && (
        <div className="flex items-center justify-between border-t border-border pt-2">
          {isOwn !== undefined && (
            <span className="text-xs text-muted">
              {isOwn ? 'You' : 'Another listener'}
            </span>
          )}
          {typeof matchCount === 'number' && !track && (
            <span className="text-xs text-muted">
              {matchCount} {matchCount === 1 ? 'resonance' : 'resonances'}
            </span>
          )}
        </div>
      )}
    </div>
  )

  if (href) {
    return (
      <a href={href} className="block hover:opacity-90">
        {inner}
      </a>
    )
  }

  return inner
}
