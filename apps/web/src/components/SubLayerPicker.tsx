// apps/web/src/components/SubLayerPicker.tsx
'use client'

import { getSubLayers, type FocusType } from '@resonance/shared'

interface Props {
  focusType: FocusType
  value: string | null
  onChange: (subLayer: string | null) => void
}

export function SubLayerPicker({ focusType, value, onChange }: Props) {
  const options = getSubLayers(focusType)

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted">Refine (optional)</p>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const active = option === value
          return (
            <button
              key={option}
              type="button"
              onClick={() => onChange(active ? null : option)}
              aria-pressed={active}
              className={[
                'min-h-8 rounded-full border px-3 text-xs font-medium transition-colors',
                active
                  ? 'border-accent bg-accent text-accent-foreground'
                  : 'border-border bg-card text-foreground hover:border-accent',
              ].join(' ')}
            >
              {option}
            </button>
          )
        })}
      </div>
    </div>
  )
}
