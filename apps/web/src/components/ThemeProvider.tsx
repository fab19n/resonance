// apps/web/src/components/ThemeProvider.tsx
'use client'

import { ThemeProvider as NextThemesProvider } from 'next-themes'
import type { ReactNode } from 'react'

export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class" // toggles class="dark" on <html> to match @custom-variant
      defaultTheme="light" // calm default
      enableSystem={false} // binary light⇄dark; flip to true for OS-aware first visit
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  )
}
