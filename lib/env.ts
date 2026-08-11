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

// Salt for the pseudonymized client IP written by the coming-soon rate limiter
// (lib/actions/subscribers/subscribeLaunch.ts). A bare sha256 of an IP is
// trivially reversible — the whole IPv4 space is 4 billion hashes — so the salt
// is what makes the stored digest actually non-identifying.
//
// If it is unset the limiter still enforces its limit, using an unsalted hash.
// Degrading pseudonymization strength is acceptable; silently dropping the
// protection is not.
export const SUBSCRIBE_RATE_LIMIT_SALT = process.env.SUBSCRIBE_RATE_LIMIT_SALT ?? ''
