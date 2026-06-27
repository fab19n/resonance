// apps/web/app/layout.tsx
import './globals.css'
import type { ReactNode } from 'react'
import { ThemeProvider } from '@/components/ThemeProvider'

export const metadata = {
  title: 'Resonance',
  description: 'A social platform built on how you listen, not what you listen to.',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  // suppressHydrationWarning: next-themes sets the theme class on <html> before
  // hydration, so the server/client html attributes intentionally differ.
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
