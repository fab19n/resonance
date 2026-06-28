import type { NextConfig } from 'next'
import path from 'node:path'

const nextConfig: NextConfig = {
  transpilePackages: ['@resonance/shared'],
  allowedDevOrigins: ['127.0.0.1'],

  // Required for pnpm monorepos: Next.js traces files for deployment starting
  // from apps/web/, which misses packages/shared/ sitting two levels up.
  // This extends the tracing root to the monorepo root so @resonance/shared
  // is included in the Vercel build output.
  outputFileTracingRoot: path.join(__dirname, '../../'),
}

export default nextConfig
