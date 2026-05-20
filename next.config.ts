import type { NextConfig } from "next"
import { withSentryConfig } from "@sentry/nextjs"

const nextConfig: NextConfig = {
  // typedRoutes: true — re-enable when auth routes (/sign-in, /sign-up), city pages, and legal pages are built
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  images: {
    remotePatterns: [
      {
        // Supabase Storage CDN — covers all hosted Supabase projects.
        // Required for next/image to serve listing-media bucket assets.
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
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
})
