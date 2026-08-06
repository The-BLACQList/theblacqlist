import * as Sentry from '@sentry/nextjs'
import { scrubPii } from '@/lib/observability/sentry-scrub'
import { APP_ENV, IS_PRODUCTION } from '@/lib/env'

Sentry.init({
  dsn: process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: APP_ENV,
  tracesSampleRate: IS_PRODUCTION ? 0.1 : 1.0,
  debug: false,
  enabled: APP_ENV !== 'development',
  sendDefaultPii: false,
  beforeSend: scrubPii,
})
