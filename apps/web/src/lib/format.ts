// apps/web/src/lib/format.ts

export function formatTime(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

/**
 * Formats a captured moment for display.
 * Point capture:  "@ 1:23"
 * Range capture:  "0:32 → 0:54"
 */
export function formatMoment(startMs: number, endMs: number | null): string {
  if (endMs !== null && endMs > startMs) {
    return `${formatTime(startMs)} → ${formatTime(endMs)}`
  }
  return `@ ${formatTime(startMs)}`
}
