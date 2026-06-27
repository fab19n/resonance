// apps/web/src/components/SensoryTagSelector.tsx
'use client'

import {
  SENSORY_TAG_CATEGORIES,
  MAX_TAGS_PER_POST,
  type SensoryTagCategory,
} from '@resonance/shared'

const CATEGORY_LABELS: Record<SensoryTagCategory, string> = {
  emotional: 'Emotional',
  texture: 'Texture',
  energy: 'Energy',
  spatial: 'Spatial',
}

export function SensoryTagSelector({
  selected,
  onChange,
  showCategoryLabels,
}: {
  selected: string[]
  onChange: (tags: string[]) => void
  showCategoryLabels: boolean
}) {
  const atMax = selected.length >= MAX_TAGS_PER_POST

  function toggle(tag: string) {
    if (selected.includes(tag)) {
      onChange(selected.filter((t) => t !== tag))
    } else if (!atMax) {
      onChange([...selected, tag])
    }
  }

  const categories = Object.keys(SENSORY_TAG_CATEGORIES) as SensoryTagCategory[]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Sensory tags</span>
        <span className="text-xs text-muted">
          {selected.length}/{MAX_TAGS_PER_POST}
        </span>
      </div>

      {categories.map((category) => (
        <div key={category} className="space-y-2">
          {showCategoryLabels && (
            <div className="text-xs uppercase tracking-wide text-muted">
              {CATEGORY_LABELS[category]}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {SENSORY_TAG_CATEGORIES[category].map((tag) => {
              const active = selected.includes(tag)
              const disabled = !active && atMax
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggle(tag)}
                  disabled={disabled}
                  aria-pressed={active}
                  className={[
                    'min-h-9 rounded-full border px-3 text-sm transition-colors',
                    active
                      ? 'border-accent bg-accent text-accent-foreground'
                      : 'border-border bg-card text-foreground hover:border-accent',
                    disabled ? 'cursor-not-allowed opacity-40 hover:border-border' : '',
                  ].join(' ')}
                >
                  {tag}
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
