// apps/web/app/login/page.tsx
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
    <main style={{ fontFamily: 'system-ui', padding: '3rem', maxWidth: 480, margin: '0 auto' }}>
      <h1>Resonance</h1>
      <p style={{ color: '#555' }}>Music is not just what you hear. It is how you hear it.</p>

      {message && (
        <p style={{ color: '#b00020', marginTop: '1rem' }}>{message}</p>
      )}

      <a
        href="/api/auth/spotify/init"
        style={{
          display: 'inline-block',
          marginTop: '2rem',
          padding: '0.75rem 1.5rem',
          background: '#1db954',
          color: '#fff',
          borderRadius: 999,
          textDecoration: 'none',
          fontWeight: 600,
        }}
      >
        Connect Spotify
      </a>
    </main>
  )
}
