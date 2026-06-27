import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // @resonance/shared is consumed as raw TS source, so Next must transpile it.
  transpilePackages: ['@resonance/shared'],
  allowedDevOrigins: ['127.0.0.1'],
}

export default nextConfig
