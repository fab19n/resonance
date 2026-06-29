// apps/web/src/components/FocusTypePicker.tsx
'use client'

import { FOCUS_TYPES, FOCUS_TYPE_LABELS, type FocusType } from '@resonance/shared'

interface Props {
  selected: FocusType | null
  onSelect: (focus: FocusType) => void
}

export function FocusTypePicker({ selected, onSelect }: Props) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {FOCUS_TYPES.map((focus) => {
        const active = focus === selected
        return (
          <button
            key={focus}
            type="button"
            onClick={() => onSelect(focus)}
            aria-pressed={active}
            className={[
              'flex min-h-12 items-center justify-center rounded-xl border px-4 text-sm font-medium transition-colors',
              active
                ? 'border-accent bg-accent text-accent-foreground'
                : 'border-border bg-card text-foreground hover:border-accent',
            ].join(' ')}
          >
            {FOCUS_TYPE_LABELS[focus]}
          </button>
        )
      })}
    </div>
  )
}
