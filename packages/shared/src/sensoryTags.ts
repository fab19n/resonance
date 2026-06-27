// packages/shared/src/sensoryTags.ts
//
// Single source of truth for the predefined sensory tag vocabulary.
// The API layer validates submitted tags against ALL_PREDEFINED_TAGS.
// Custom tags are accepted on top (max 30 chars, alphanumeric + hyphens),
// with a hard cap of 6 tags total per post.

export const SENSORY_TAG_CATEGORIES = {
  emotional: [
    'melancholic', 'euphoric', 'anxious', 'peaceful',
    'nostalgic', 'raw', 'hopeful', 'tense',
  ],
  texture: [
    'heavy', 'light', 'warm', 'cold',
    'gritty', 'smooth', 'dense', 'sparse',
  ],
  energy: [
    'driving', 'hypnotic', 'building', 'explosive',
    'meditative', 'frantic', 'calm',
  ],
  spatial: [
    'vast', 'intimate', 'open', 'distant',
    'close', 'claustrophobic', 'bright', 'dark',
  ],
} as const

export type SensoryTagCategory = keyof typeof SENSORY_TAG_CATEGORIES

export type SensoryTag =
  (typeof SENSORY_TAG_CATEGORIES)[SensoryTagCategory][number]

export const ALL_PREDEFINED_TAGS: readonly string[] = Object.values(
  SENSORY_TAG_CATEGORIES,
).flat()
