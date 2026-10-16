// The October 2026 Privacy Policy, Terms and Cookie Policy update (AI writing
// help, bringing in a website, Cloudflare Turnstile). Ticket 139.
//
// Privacy §10 and Terms §13 promise registered users an email at least 14 days
// before a material change takes effect. So the new text goes up early behind a
// "Takes effect" date, and each page switches to it on its own once that date
// passes. Until then, /privacy, /terms and /cookies show the current text with a
// banner, and /privacy/upcoming (and the others) show the new text.
//
// The 14 days start when the notice email goes out (scripts/ops/send-policy-notice.ts),
// not when this ships. If the email goes out late, move all three dates here by
// the same number of days before sending it, and the email picks them up.
//
// Pure data and date math, so pages, the email template and tests can all use it.

export const POLICY_UPDATE = {
  /** The day the new text is posted and the notice email is sent. */
  postedOnLabel: 'October 19, 2026',
  /** The day the new text takes effect, as people read it. */
  effectiveOnLabel: 'November 2, 2026',
  /**
   * Midnight Eastern at the start of the effective day. Daylight saving time
   * ends on November 1, 2026, so Eastern is UTC-5 by then.
   */
  effectiveAt: '2026-11-02T00:00:00-05:00',
  /**
   * The last moment the notice email can go out: the end of the posted day,
   * Eastern (still daylight time in October, so UTC-4). tests/policy-update.test.ts
   * checks it stays 14 calendar days before the effective day.
   */
  sendBy: '2026-10-19T23:59:59-04:00',
} as const

export type PolicyVersion = 'current' | 'next'

/** True once the updated text has taken effect. */
export function isPolicyUpdateInEffect(now: Date = new Date()): boolean {
  return now.getTime() >= new Date(POLICY_UPDATE.effectiveAt).getTime()
}

/** Privacy §10 and Terms §13: email notice at least this many days ahead. */
export const MIN_NOTICE_DAYS = 14

/**
 * True while an email sent now still lands at least MIN_NOTICE_DAYS calendar
 * days before the effective day. The send script refuses to run once this is
 * false, which is the cue to move all three dates above.
 */
export function noticeWindowIsOpen(now: Date = new Date()): boolean {
  return now.getTime() <= new Date(POLICY_UPDATE.sendBy).getTime()
}

/** Which text a live policy page shows right now. */
export function livePolicyVersion(now: Date = new Date()): PolicyVersion {
  return isPolicyUpdateInEffect(now) ? 'next' : 'current'
}

/** The line under a policy page's title for the updated text. */
export function nextVersionSubtitle(now: Date = new Date()): string {
  const when = isPolicyUpdateInEffect(now) ? 'In effect since' : 'Takes effect'
  return `Last updated: ${POLICY_UPDATE.postedOnLabel} · ${when}: ${POLICY_UPDATE.effectiveOnLabel}`
}

/**
 * How long a policy page's cached render may live. The switch to the new text
 * happens on the next render after the effective time, so this bounds how late
 * it can be.
 */
export const POLICY_PAGE_REVALIDATE_SECONDS = 3600
