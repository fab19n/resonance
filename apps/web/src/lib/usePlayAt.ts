// apps/web/src/lib/usePlayAt.ts
//
// Web-only UI layer for the play-at feature. The API contract (PlayAtErrorCode)
// is shared with mobile via @resonance/shared; the actual message copy below
// is web-specific by design — a future Expo build owns its own wording.

'use client'

import { useState, useRef, useCallback } from 'react'
import type { PlayAtErrorCode, PlayAtResponse } from '@resonance/shared'

const ERROR_MESSAGES: Record<PlayAtErrorCode, string> = {
  no_active_device: 'Open Spotify on a device, then tap again',
  premium_required: 'Playing from a moment requires Spotify Premium',
  track_not_found: "Couldn't find this track on Spotify",
  unknown: "Couldn't play this right now",
}

const MESSAGE_DURATION_MS = 5000

export function usePlayAt() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [message, setMessage] = useState<string | null>(null)
  const clearTimer = useRef<ReturnType<typeof setTimeout>>()

  const play = useCallback(async (isrc: string, positionMs: number) => {
    clearTimeout(clearTimer.current)
    setStatus('loading')
    setMessage(null)

    try {
      const res = await fetch('/api/spotify/play-at', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isrc, positionMs }),
      })
      const data = (await res.json()) as PlayAtResponse

      if (data.ok) {
        setStatus('idle')
        return
      }

      setStatus('error')
      setMessage(ERROR_MESSAGES[data.errorCode ?? 'unknown'])
    } catch {
      setStatus('error')
      setMessage(ERROR_MESSAGES.unknown)
    }

    clearTimer.current = setTimeout(() => {
      setStatus('idle')
      setMessage(null)
    }, MESSAGE_DURATION_MS)
  }, [])

  return { play, status, message }
}
