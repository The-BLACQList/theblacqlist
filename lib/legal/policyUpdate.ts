// The October 2026 Privacy Policy, Terms and Cookie Policy update (AI writing
// help, bringing in a website, Cloudflare Turnstile). Ticket 139.
//
// The founder made this update take effect on the day it was posted,
// October 16, 2026, because real AI drafts went live that day (approved
// 2026-10-16, counsel review to follow). The notice email is now a "we've
// updated" message that goes out promptly after (scripts/ops/send-policy-notice.ts).
//
// The pages still switch on effectiveAt: before it, /privacy, /terms and
// /cookies show the current text with a banner and /privacy/upcoming (and the
// others) show the new text. After it, the main pages show the new text and the
// /upcoming pages redirect there. With effectiveAt already passed, the new text
// is what everyone sees. Reuse the same switch for a future dated update.
//
// Pure data and date math, so pages, the email template and tests can all use it.

export const POLICY_UPDATE = {
  /** The day the new text was posted. */
  postedOnLabel: 'October 16, 2026',
  /** The day the new text took effect, as people read it. */
  effectiveOnLabel: 'October 16, 2026',
  /** Midnight Eastern at the start of the effective day (daylight time, UTC-4). */
  effectiveAt: '2026-10-16T00:00:00-04:00',
} as const

export type PolicyVersion = 'current' | 'next'

/** True once the updated text has taken effect. */
export function isPolicyUpdateInEffect(now: Date = new Date()): boolean {
  return now.getTime() >= new Date(POLICY_UPDATE.effectiveAt).getTime()
}

/** Which text a live policy page shows right now. */
export function livePolicyVersion(now: Date = new Date()): PolicyVersion {
  return isPolicyUpdateInEffect(now) ? 'next' : 'current'
}

/** The line under a policy page's title for the updated text. */
export function nextVersionSubtitle(now: Date = new Date()): string {
  const posted = `Last updated: ${POLICY_UPDATE.postedOnLabel}`
  const inEffect = isPolicyUpdateInEffect(now)
  if (inEffect && POLICY_UPDATE.postedOnLabel === POLICY_UPDATE.effectiveOnLabel) return posted
  const when = inEffect ? 'In effect since' : 'Takes effect'
  return `${posted} · ${when}: ${POLICY_UPDATE.effectiveOnLabel}`
}

/**
 * How long a policy page's cached render may live. The switch to the new text
 * happens on the next render after the effective time, so this bounds how late
 * it can be.
 */
export const POLICY_PAGE_REVALIDATE_SECONDS = 3600

/**
 * Terms section 13, "Paid Plans and Billing" (ticket 144). The founder posted
 * it effective on posting, 2026-10-29, so it doesn't use the dated switch above.
 * Change this label if the Terms page goes live on a later day.
 */
export const TERMS_PAID_PLANS = {
  postedOnLabel: 'October 29, 2026',
  anchor: 'paid-plans',
} as const

/**
 * Privacy Policy section 6 adds OpenStreetMap (Nominatim), finding F3 of the
 * search zero-result log review (ticket 142). The founder approved it on
 * 2026-10-29, effective on posting, so it doesn't use the dated switch above.
 * Change this label if the page goes live on a later day.
 */
export const PRIVACY_PROVIDERS_UPDATE = {
  // Moved to the Cue update (ticket 148). Change it if that merges on a later day.
  postedOnLabel: 'October 30, 2026',
} as const
