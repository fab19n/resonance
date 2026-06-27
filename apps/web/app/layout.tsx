// apps/web/app/layout.tsx
import type { ReactNode } from 'react'

export const metadata = {
  title: 'Resonance',
  description: 'A social platform built on how you listen, not what you listen to.',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
