import * as Sentry from "@sentry/nextjs"

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 1.0,
  // Reduce noise in development
  enabled: process.env.NODE_ENV === "production",
  // Session replay for error reproduction (1% of all sessions, 100% of sessions with errors)
  replaysSessionSampleRate: 0.01,
  replaysOnErrorSampleRate: 1.0,
})
