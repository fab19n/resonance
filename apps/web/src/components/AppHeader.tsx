// apps/web/src/components/AppHeader.tsx
'use client'

import { NotificationsBell } from './NotificationsBell'
import { MessagesIcon } from './MessagesIcon'
import { ThemeToggle } from './ThemeToggle'

type Surface = 'capture' | 'resonances' | 'profile'

const NAV: { key: Surface; label: string; href: string }[] = [
  { key: 'capture', label: 'Capture', href: '/home' },
  { key: 'resonances', label: 'Resonances', href: '/resonances' },
  { key: 'profile', label: 'Profile', href: '/profile' },
]

export function AppHeader({ active }: { active?: Surface }) {
  return (
    <header className="mb-8 flex items-center justify-between gap-4">
      <nav className="flex items-center gap-4 text-sm">
        {NAV.map((item) => (
          <a
            key={item.key}
            href={item.href}
            className={
              item.key === active
                ? 'font-semibold text-foreground'
                : 'text-muted transition-colors hover:text-foreground'
            }
          >
            {item.label}
          </a>
        ))}
      </nav>
      <div className="flex items-center gap-2">
        <MessagesIcon />
        <NotificationsBell />
        <ThemeToggle />
      </div>
    </header>
  )
}
