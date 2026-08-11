/**
 * Security response headers, applied by `next.config.ts` `headers()`.
 *
 * The open question was whether that layer reaches a middleware redirect,
 * because `proxy.ts` 307s every public path to /coming-soon today and a
 * header the public never receives is not a protection. It does: against a
 * local production build with COMING_SOON_MODE=true, `/` returned
 * `307` carrying all three, and `/coming-soon` returned `200` carrying all
 * three `[Measured — curl localhost, 2026-08-11]`. So middleware needs no
 * copy of this list, and there is no second place for it to drift out of.
 *
 * Deliberately NOT set here:
 *
 * `Strict-Transport-Security` — Vercel already serves
 * `max-age=63072000` on this project. That is two years, longer than the
 * one year `docs/blacqlist/architecture/security-and-privacy-plan.md`
 * proposed, and setting it ourselves would only be a way to also add
 * `includeSubDomains` — a two-year, hard-to-reverse commitment binding every
 * present and future subdomain to HTTPS, for no gain on the apex.
 *
 * `Content-Security-Policy` — a real project, not a header. It needs a
 * report-only soak before it can be enforced without breaking Stripe, Sentry,
 * Supabase and the map tiles. Scheduled at V4.
 *
 * `Permissions-Policy` — the architecture doc proposes
 * `camera=(), microphone=(), geolocation=()`, but two shipped surfaces use
 * `capture="environment"` file inputs (`components/dashboard/MediaGrid.tsx`,
 * `components/spend/ReceiptSubmissionForm.tsx`). Whether `camera=()` blocks a
 * capture-hinted file input, as opposed to `getUserMedia`, is unmeasured — and
 * receipt upload is the input the whole spend pipeline depends on. Blocking it
 * on an assumption is not a trade worth making inside this checkpoint.
 */
export const SECURITY_HEADERS = [
  {
    // No framing at all. Nothing on the site is designed to be embedded.
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  {
    // Browsers must honour the declared Content-Type. The three upload
    // endpoints trust a client-declared MIME type today, so a stored file
    // being re-interpreted as script is a live path, not a theoretical one.
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    // Full URL to same-origin, origin only cross-origin, nothing over
    // plain HTTP. Listing and account URLs identify what a user was looking
    // at; they should not travel to third parties in a Referer header.
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
] as const
