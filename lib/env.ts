// Single source of truth for "which environment am I running in?"
//
// Vercel sets VERCEL_ENV (server) and NEXT_PUBLIC_VERCEL_ENV (client, via
// system env var exposure) to 'production' | 'preview' | 'development'.
// NODE_ENV is NOT a deployment discriminator — Vercel sets NODE_ENV=production
// on Preview builds too, which is why previews used to report into Sentry as
// "production". Local dev (and any non-Vercel host) falls back via NODE_ENV.
export type AppEnv = 'production' | 'preview' | 'development'

export const APP_ENV: AppEnv = (process.env.VERCEL_ENV ??
  process.env.NEXT_PUBLIC_VERCEL_ENV ??
  (process.env.NODE_ENV === 'production' ? 'production' : 'development')) as AppEnv

export const IS_PRODUCTION = APP_ENV === 'production'
export const IS_PREVIEW = APP_ENV === 'preview'
