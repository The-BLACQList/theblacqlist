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

// Self-serve tester admission (app/join/route.ts). A second, independently
// revocable secret next to COMING_SOON_BYPASS_TOKEN: the bypass token is what the
// invite email carries and what the cookie stores, this one is what a printed
// flyer / QR code carries. Keeping them separate means the flyer can be pulled
// (delete the var in Vercel) without invalidating anyone who was invited by
// email, and vice versa. Empty string means the flyer path is closed.
//
// Server-only, never logged, never compared with `===` (see the route).
export const TESTER_FLYER_CODE = process.env.TESTER_FLYER_CODE ?? ''

// =============================================================================
// Feature flags — checkpoint X.1
// =============================================================================
// Until now the only rollout gate this codebase had was Stripe tier entitlement
// (lib/stripe/features.ts, `GatedFeature` + `canAccess`). That answers "has this
// business paid for it?" — a *billing* question. It cannot answer "is this
// surface switched on yet?", so anything half-finished had to ship behind a
// launch rather than behind a switch. These flags are the rollout half. Keep the
// two apart: a flag decides whether a surface exists at all, entitlement decides
// who may use it once it does.
//
// SERVER-ONLY, deliberately. None of these are NEXT_PUBLIC_, so Next.js does not
// inline them into the client bundle — a NEXT_PUBLIC_ flag would be frozen into
// the JS at build time and could only ever change by rebuilding. To gate client
// UI, read the flag in a Server Component and pass the boolean down as a prop.
//
// ⚠ Flipping one of these still requires REDEPLOYING THE SAME COMMIT. Vercel
// binds environment variables to a deployment, so an existing deployment keeps
// the values it was created with. There is no code change, no PR and no merge —
// but this is not a live runtime toggle. A genuine no-redeploy flip needs
// @vercel/global-config (formerly Edge Config) or a DB-backed flag table, both
// of which are out of scope for v1. Percentage rollout is also explicitly not
// in v1.
//
// ⚠ A flag read during static prerendering is baked into the HTML at BUILD time,
// which means the redeploy above is not enough to change it. Any route that
// gates on a flag must opt out of static generation — `export const dynamic =
// 'force-dynamic'` — or read the flag somewhere already dynamic (a route
// handler, a server action, or a request-scoped Server Component).
export type FeatureFlag =
  | 'aiBeta'
  | 'ocrExtraction'
  | 'paidPostings'
  | 'postingSubmissions'
  | 'testerTour'

// The map is the registry. Adding a flag means adding it here and to the union
// above, which is what makes `isFeatureEnabled` typo-proof at the call site.
const FEATURE_FLAG_ENV_VARS: Record<FeatureFlag, string> = {
  aiBeta: 'FEATURE_AI_BETA',
  ocrExtraction: 'FEATURE_OCR_EXTRACTION',
  // E-2. Covers BOTH halves of the monetization change — charging for job
  // postings and enforcing the events cap — on purpose, even though they are
  // two features. They are one behavior change from a user's point of view
  // ("what it costs to post"), and splitting them into two flags would allow a
  // half-state where jobs are paid but the events copy is still untrue.
  paidPostings: 'FEATURE_PAID_POSTINGS',
  // Gates the /add-event and /add-job submission forms, the event/job half of
  // createListingAction, and every inbound link to those two forms — the footer's
  // "For Businesses" entries and the CTAs on /events and /jobs. One flag rather
  // than two for the same reason as paidPostings above: "can I post an event or a
  // job" is one behavior to a user, and two flags would permit a half-state.
  //
  // The links must stay on this flag: both /add-* pages notFound() while it is
  // off, so an ungated link is a link to a 404.
  //
  // Does NOT gate the public /events and /jobs pages themselves. Those query
  // published listings of their type and are correct either way — with the flag
  // off they are a real, empty board rather than a page promising a feature.
  postingSubmissions: 'FEATURE_POSTING_SUBMISSIONS',
  // Gates the Tester Tour: the progress rail, the page-render witnesses, the
  // reflection action, the tour-state API route, and the trial-claim path. The
  // default (on in preview, off in production) is exactly right here — the tour
  // is reviewed on Previews, and production stays dark until GATE-DEPLOY sets
  // FEATURE_TESTER_TOUR=true for the soft-launch cohort. Unsetting it again is
  // how the tour retires: rail and claim route disappear without deploying
  // different code. Evidence rows and any granted trials remain — trials are
  // real Stripe subscriptions and must be cancelled deliberately, not by flag.
  testerTour: 'FEATURE_TESTER_TOUR',
}

// `undefined` means "this env var said nothing usable" — unset, blank, or a
// value we don't recognize — and the caller falls back to the per-environment
// default. An unrecognized value is deliberately NOT treated as truthy: a
// `FEATURE_AI_BETA=maybe` typo leaves the feature off in production rather than
// switching it on by accident.
function parseFlagValue(raw: string | undefined): boolean | undefined {
  const value = raw?.trim().toLowerCase()
  if (!value) return undefined
  if (['1', 'true', 'on', 'yes', 'enabled'].includes(value)) return true
  if (['0', 'false', 'off', 'no', 'disabled'].includes(value)) return false
  return undefined
}

/**
 * Is this feature switched on for the current deployment?
 *
 * Defaults to **off in production** and **on everywhere else**, so a
 * half-finished surface is visible on every Preview — where it gets reviewed —
 * while `main` stays safe to merge into at any point.
 *
 * This fails CLOSED, the opposite of `lib/security/rate-limit.ts`. That limiter
 * fails open because an outage in it must never take public search down with it.
 * A flag guards a surface that nobody is depending on yet, so the safe direction
 * when the configuration is unclear is "not shipped".
 *
 * Reads `process.env` on every call rather than resolving a frozen const map at
 * import, for the same reason `getAppUrl()` below is a function: module-scope
 * evaluation happens once, at an unpredictable moment, and is untestable.
 */
export function isFeatureEnabled(flag: FeatureFlag): boolean {
  const explicit = parseFlagValue(process.env[FEATURE_FLAG_ENV_VARS[flag]])
  if (explicit !== undefined) return explicit
  return !IS_PRODUCTION
}

/**
 * Every flag currently on, for ops surfaces and debugging. Reports state — it is
 * not a permission check; gate real behavior on `isFeatureEnabled`.
 */
export function getEnabledFeatures(): FeatureFlag[] {
  return (Object.keys(FEATURE_FLAG_ENV_VARS) as FeatureFlag[]).filter(isFeatureEnabled)
}

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
