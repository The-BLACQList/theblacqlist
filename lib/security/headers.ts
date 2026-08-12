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
 * That was the reasoning; it is now a measurement. `mail.theblacqlist.com`
 * resolves to 50.87.230.81 (Bluehost) and its TLS certificate does not match
 * the hostname — `curl` fails with "no alternative certificate subject name
 * matches target host name" `[Measured — dig + curl + openssl, 2026-08-12]`.
 * Under `includeSubDomains` that becomes a hard browser block with no
 * click-through, for two years, on a DNS record we did not audit first. So the
 * header stays exactly as Vercel serves it. Revisit only after the stale
 * Bluehost records are removed and every remaining subdomain is confirmed on
 * valid HTTPS; `preload` is a separate, effectively irreversible decision after
 * that.
 *
 * `Content-Security-Policy` — a real project, not a header. It needs a
 * report-only soak before it can be enforced without breaking Stripe, Sentry,
 * Supabase and the map tiles. Scheduled at V4.
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
  {
    // Deny the two powerful features nothing on the site uses, and pin the
    // one it is about to.
    //
    // `camera=()` / `microphone=()`: there is no `getUserMedia`,
    // `mediaDevices`, or `MediaRecorder` call anywhere under app/, components/,
    // or lib/ `[Measured — repo grep, 2026-08-12]`. Denying them costs nothing
    // today and means an injected script cannot reach either device.
    //
    // The open question was the two `capture="environment"` file inputs
    // (`components/dashboard/MediaGrid.tsx:330`,
    // `components/spend/ReceiptSubmissionForm.tsx:168`). Per spec those go
    // through the native file picker, not the Camera API, so
    // Permissions-Policy `camera` should not gate them — but that is spec
    // reasoning, not a measurement, and receipt upload is the input the whole
    // spend pipeline depends on. Both are verified on a real device against
    // this PR's preview before it merges; if either breaks, drop `camera=()`
    // and keep the rest.
    //
    // `geolocation=(self)` deliberately, NOT `geolocation=()` as
    // security-and-privacy-plan.md proposed. The C3 "Near You" radius filter
    // needs `navigator.geolocation` on our own origin, so `()` would ship a
    // header that breaks a feature already approved and in flight. `(self)`
    // matches the current default explicitly and denies it to embedded
    // third parties — the video iframe in
    // `components/entity-page/EntityVideoSection.tsx:47` is the only one, and
    // it asks for `encrypted-media; picture-in-picture`, neither of which is
    // touched here.
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(self)',
  },
] as const
