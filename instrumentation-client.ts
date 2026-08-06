// Client-side Sentry init. Lives in instrumentation-client.ts (NOT
// sentry.client.config.ts) because Next 15+/Turbopack auto-loads this filename;
// the legacy config is not reliably injected under Turbopack, so browser errors
// would otherwise go uncaptured. Mirrors sentry.server.config.ts.
import * as Sentry from '@sentry/nextjs'
import { scrubPii } from '@/lib/observability/sentry-scrub'
import { APP_ENV, IS_PRODUCTION } from '@/lib/env'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: APP_ENV,
  tracesSampleRate: IS_PRODUCTION ? 0.1 : 1.0,
  debug: false,
  enabled: APP_ENV !== 'development',
  sendDefaultPii: false,
  beforeSend: scrubPii,
})

// App Router navigation instrumentation (Sentry's recommended client export).
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
