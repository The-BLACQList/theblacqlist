import * as Sentry from '@sentry/nextjs'

// Next.js instrumentation hook (auto-loaded by Next 15+/16). REQUIRED for
// @sentry/nextjs v8+ to initialize Sentry on the server and edge runtimes:
// sentry.server.config.ts / sentry.edge.config.ts are NOT auto-loaded on their
// own, so without this file Sentry never initializes server-side and no
// server-side error (route handlers, Server Components) is ever captured.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config')
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config')
  }
}

// Forwards server-side request errors (route handlers, RSC, etc.) to Sentry.
export const onRequestError = Sentry.captureRequestError
