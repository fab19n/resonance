// packages/shared/src/subLayers.ts
//
// Sub-layer vocabulary per focus type.
// Sub-layers are an optional second level of specificity within a focus type.
// Example: focusType = 'production', subLayer = '808'
//
// The API layer validates submitted sub-layers against this map.
// An empty string or absent subLayer field = no sub-layer selected (valid).

import type { FocusType } from './types'

export const SUB_LAYER_MAP: Record<FocusType, readonly string[]> = {
  lyrics:          ['hook', 'verse', 'chorus', 'bridge', 'wordplay', 'rhyme-scheme', 'punchline'],
  production:      ['808', 'hi-hats', 'sample', 'beat-switch', 'bassline', 'mix-mastering', 'synth'],
  emotion:         ['nostalgia', 'euphoria', 'sadness', 'calm', 'tension', 'anger', 'longing'],
  vocals:          ['melody', 'delivery', 'ad-libs', 'tone', 'phrasing', 'harmony', 'falsetto'],
  rhythm:          ['groove', 'tempo-change', 'syncopation', 'swing', 'drop', 'polyrhythm'],
  beat:            ['drum-pattern', 'kick', 'snare', 'loop', 'chop', 'fill'],
  instrumentation: ['guitar', 'piano', 'strings', 'brass', 'percussion', 'bass'],
  structure:       ['intro', 'verse', 'chorus', 'bridge', 'outro', 'transition', 'breakdown'],
} as const

export type SubLayer = typeof SUB_LAYER_MAP[FocusType][number]

/** Returns the sub-layer options for a given focus type. Always a non-empty array. */
export const getSubLayers = (focusType: FocusType): readonly string[] =>
  SUB_LAYER_MAP[focusType]

/** Validates that a sub-layer string is valid for its focus type. */
export const isValidSubLayer = (focusType: FocusType, subLayer: string): boolean =>
  (SUB_LAYER_MAP[focusType] as readonly string[]).includes(subLayer)
