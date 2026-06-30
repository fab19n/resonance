// apps/web/src/components/SensoryTagSelector.tsx
'use client'

import { useState } from 'react'
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

interface Props {
  selected: string[]
  onChange: (tags: string[]) => void
}

export function SensoryTagSelector({ selected, onChange }: Props) {
  // All groups start collapsed
  const [openGroups, setOpenGroups] = useState<Set<SensoryTagCategory>>(new Set())

  const atMax = selected.length >= MAX_TAGS_PER_POST
  const categories = Object.keys(SENSORY_TAG_CATEGORIES) as SensoryTagCategory[]

  function toggleGroup(category: SensoryTagCategory) {
    setOpenGroups((prev) => {
      const next = new Set(prev)
      if (next.has(category)) next.delete(category)
      else next.add(category)
      return next
    })
  }

  function toggleTag(tag: string) {
    if (selected.includes(tag)) {
      onChange(selected.filter((t) => t !== tag))
    } else if (!atMax) {
      onChange([...selected, tag])
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Sensory tags</span>
        <span className="text-xs text-muted">
          {selected.length}/{MAX_TAGS_PER_POST}
        </span>
      </div>

      {categories.map((category) => {
        const isOpen = openGroups.has(category)
        const tags = SENSORY_TAG_CATEGORIES[category]
        const selectedInGroup = tags.filter((t) => selected.includes(t))

        return (
          <div key={category} className="rounded-xl border border-border overflow-hidden">
            {/* Group header — always visible */}
            <button
              type="button"
              onClick={() => toggleGroup(category)}
              className="flex w-full items-center justify-between px-3 py-2.5 text-left transition-colors hover:bg-border/30"
            >
              <span className="text-sm font-medium">{CATEGORY_LABELS[category]}</span>
              <div className="flex items-center gap-2">
                {selectedInGroup.length > 0 && !isOpen && (
                  <span className="rounded-full bg-accent px-2 py-0.5 text-xs text-accent-foreground">
                    {selectedInGroup.length}
                  </span>
                )}
                <span className="text-xs text-muted transition-transform duration-200"
                  style={{ display: 'inline-block', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
                >
                  ▾
                </span>
              </div>
            </button>

            {/* Tags — shown when expanded */}
            {isOpen && (
              <div className="flex flex-wrap gap-2 border-t border-border px-3 py-3">
                {tags.map((tag) => {
                  const active = selected.includes(tag)
                  const disabled = !active && atMax
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleTag(tag)}
                      disabled={disabled}
                      aria-pressed={active}
                      className={[
                        'min-h-8 rounded-full border px-3 text-xs transition-colors',
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
            )}
          </div>
        )
      })}
    </div>
  )
}
