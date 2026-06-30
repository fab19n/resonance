// apps/web/src/components/PlayerControls.tsx
//
// Three large touch-friendly player controls.
// ⏮ and ⏭: single tap = previous/next track, long press = seek back/forward
// Long press activates after 500ms, then seeks 2s every 250ms while held.

'use client'

import { useRef } from 'react'

interface Props {
  isPlaying: boolean
  isLive: boolean              // false = search track, disable controls
  onTogglePlay: () => void
  onPrevious: () => void
  onNext: () => void
  onSeek: (ms: number) => void
  currentProgressMs: number
  durationMs: number
}

const LONG_PRESS_DELAY = 500   // ms before long press activates
const SEEK_INTERVAL = 250      // ms between each seek step
const SEEK_STEP = 2000         // ms per step

function useLongPress(
  onSinglePress: () => void,
  onSeekStep: () => void,
) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined)
  const longPressActivated = useRef(false)

  function onPointerDown() {
    longPressActivated.current = false
    timerRef.current = setTimeout(() => {
      longPressActivated.current = true
      onSeekStep()
      intervalRef.current = setInterval(onSeekStep, SEEK_INTERVAL)
    }, LONG_PRESS_DELAY)
  }

  function onPointerUp() {
    clearTimeout(timerRef.current)
    clearInterval(intervalRef.current)
    if (!longPressActivated.current) {
      onSinglePress()
    }
    longPressActivated.current = false
  }

  function onPointerLeave() {
    clearTimeout(timerRef.current)
    clearInterval(intervalRef.current)
    longPressActivated.current = false
  }

  return { onPointerDown, onPointerUp, onPointerLeave }
}

export function PlayerControls({
  isPlaying,
  isLive,
  onTogglePlay,
  onPrevious,
  onNext,
  onSeek,
  currentProgressMs,
  durationMs,
}: Props) {
  const prevHandlers = useLongPress(
    onPrevious,
    () => onSeek(Math.max(0, currentProgressMs - SEEK_STEP)),
  )

  const nextHandlers = useLongPress(
    onNext,
    () => onSeek(Math.min(durationMs, currentProgressMs + SEEK_STEP)),
  )

  const btnBase =
    'flex items-center justify-center rounded-full transition-opacity select-none'
  const disabledCls = !isLive ? 'opacity-30 pointer-events-none' : ''

  return (
    <div className="flex items-center justify-center gap-8">
      {/* Previous / seek back */}
      <button
        type="button"
        {...prevHandlers}
        disabled={!isLive}
        className={`${btnBase} h-14 w-14 bg-card border border-border text-foreground shadow-sm active:scale-95 ${disabledCls}`}
        aria-label="Previous track (hold to seek back)"
        style={{ touchAction: 'none' }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
          <path d="M6 6h2v12H6zm3.5 6 8.5 6V6z" />
        </svg>
      </button>

      {/* Play / Pause */}
      <button
        type="button"
        onClick={onTogglePlay}
        disabled={!isLive}
        className={`${btnBase} h-16 w-16 bg-accent text-accent-foreground shadow-md active:scale-95 ${disabledCls}`}
        aria-label={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 19h4V5H6zm8-14v14h4V5z" />
          </svg>
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>

      {/* Next / seek forward */}
      <button
        type="button"
        {...nextHandlers}
        disabled={!isLive}
        className={`${btnBase} h-14 w-14 bg-card border border-border text-foreground shadow-sm active:scale-95 ${disabledCls}`}
        aria-label="Next track (hold to seek forward)"
        style={{ touchAction: 'none' }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
          <path d="M6 18l8.5-6L6 6v12zm2.5-6 5.5 3.9V8.1L8.5 12zM16 6h2v12h-2z" />
        </svg>
      </button>
    </div>
  )
}