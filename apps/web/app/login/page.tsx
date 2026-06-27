// apps/web/app/login/page.tsx
import { ThemeToggle } from '@/components/ThemeToggle'

const ERROR_MESSAGES: Record<string, string> = {
  access_denied: 'You declined the Spotify permission request.',
  state_mismatch: 'Login session expired or was tampered with. Please try again.',
  missing_code: 'Spotify did not return an authorization code.',
  missing_verifier: 'Login session expired. Please try again.',
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  const message = error ? (ERROR_MESSAGES[error] ?? 'Something went wrong. Please try again.') : null

  return (
    <main className="relative mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <div className="fixed right-4 top-4">
        <ThemeToggle />
      </div>

      <h1 className="text-3xl font-semibold tracking-tight">Resonance</h1>
      <p className="mt-2 text-muted">Music is not just what you hear. It is how you hear it.</p>

      {message && <p className="mt-4 text-sm text-red-500">{message}</p>}

      <a
        href="/api/auth/spotify/init"
        className="mt-8 inline-flex h-12 items-center justify-center rounded-full bg-accent px-6 font-medium text-accent-foreground transition-opacity hover:opacity-90"
      >
        Connect Spotify
      </a>
    </main>
  )
}
