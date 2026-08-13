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

// Absolute origin for links that must resolve back to *this* deployment — auth
// confirmation and password-recovery redirects above all.
//
// NEXT_PUBLIC_APP_URL is set at Production scope only, so on a Preview the old
// inline `?? 'http://localhost:3000'` fallback fired and every confirmation
// email pointed at the tester's own machine — which is why nobody could sign in
// on a Preview to verify a PR. VERCEL_URL is injected on every Vercel
// deployment (Previews included) and carries no protocol, so it belongs in the
// middle: explicit config first, real deployment second, local dev last.
//
// SERVER-ONLY. VERCEL_URL is not a NEXT_PUBLIC_ var, so it is not inlined into
// the client bundle. This is a function rather than a const precisely so that
// importing this module from client code (instrumentation-client.ts does) can't
// quietly evaluate it to localhost.
export function getAppUrl(): string {
  // `|| undefined` so an empty-string env var falls through instead of winning
  // the ?? chain. VERCEL_URL carries no protocol, hence the prefix.
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, '') || undefined
  const deployment = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined
  return explicit ?? deployment ?? 'http://localhost:3000'
}
