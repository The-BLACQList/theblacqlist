import type { NextConfig } from 'next'
import { withSentryConfig } from '@sentry/nextjs'

import { SECURITY_HEADERS } from './lib/security/headers'

const nextConfig: NextConfig = {
  // typedRoutes: true — re-enable when auth routes (/sign-in, /sign-up), city pages, and legal pages are built
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  // Removes `x-powered-by: Next.js`. It names the framework and its version
  // surface for anyone probing, and nothing in the app reads it.
  poweredByHeader: false,
  // The share-card route reads its fonts and the gold mark with readFile at a
  // path built at runtime, which the file tracer can't follow. Without this the
  // deployed function has no fonts and every card is a 500.
  outputFileTracingIncludes: {
    '/api/share-card/**': ['./assets/fonts/**', './public/brand/blacqlist-mark-gold-256.png'],
  },
  async headers() {
    return [{ source: '/:path*', headers: [...SECURITY_HEADERS] }]
  },
  // /cities is gone. Old links and search results land on Discover, not the 404
  // page. `[Decision — founder, 2026-11-06]`
  async redirects() {
    return [{ source: '/cities', destination: '/discover', permanent: true }]
  },
  images: {
    remotePatterns: [
      {
        // Supabase Storage CDN — covers all hosted Supabase projects.
        // Required for next/image to serve listing-media bucket assets.
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
      {
        // Local Supabase dev server
        protocol: 'http',
        hostname: '127.0.0.1',
        port: '54321',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
}

export default withSentryConfig(nextConfig, {
  // Suppresses Sentry build output noise unless SENTRY_AUTH_TOKEN is set
  silent: !process.env.SENTRY_AUTH_TOKEN,
  // Source map upload requires SENTRY_AUTH_TOKEN + SENTRY_ORG + SENTRY_PROJECT env vars at build time
  authToken: process.env.SENTRY_AUTH_TOKEN,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  sourcemaps: { deleteSourcemapsAfterUpload: true },
  widenClientFileUpload: true,
  disableLogger: true,
})
