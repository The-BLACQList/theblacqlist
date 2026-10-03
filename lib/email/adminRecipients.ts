import * as Sentry from '@sentry/nextjs'

// =============================================================================
// Who gets the admin "new claim" and "verification requested" emails
// =============================================================================
// 2026-10-03: Resend rejected the admin copy of a real claim with "Invalid `to`
// field" because ADMIN_NOTIFICATION_EMAIL held something other than one plain
// address. The variable is marked sensitive in Vercel, so the bad shape could
// not even be read back. This parses it forgivingly: quotes and spaces are
// stripped, commas, semicolons and newlines separate several addresses, and
// `Name <address>` is kept as written. Anything that still is not an address is
// dropped, and when nothing valid is left the admin email is skipped with one
// clear Sentry warning instead of a rejected send on every claim.
// =============================================================================

// Deliberately simple. Resend does the real validation; this only stops values
// that can never be an address from reaching it.
const ADDRESS = /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[^\s@<>"',;]+$/
const NAMED = /^[^<>]*<([^<>]+)>$/

function unquote(value: string): string {
  return value.trim().replace(/^["'`]+|["'`]+$/g, '').trim()
}

/** Every usable recipient in a raw env value, in order, without duplicates. */
export function parseAdminRecipients(raw: string | undefined): string[] {
  if (!raw) return []
  const out: string[] = []
  for (const part of unquote(raw).split(/[,;\n\r]+/)) {
    const entry = unquote(part)
    if (!entry) continue
    const named = NAMED.exec(entry)
    const address = named ? named[1]!.trim() : entry
    if (!ADDRESS.test(address)) continue
    if (!out.includes(entry)) out.push(entry)
  }
  return out
}

let invalidReported = false

/**
 * The admin recipients from ADMIN_NOTIFICATION_EMAIL. Empty when the variable
 * is unset (admin email is off by choice) or holds no usable address (reported
 * to Sentry once per process). The value itself is never logged.
 */
export function adminNotificationRecipients(): string[] {
  const raw = process.env.ADMIN_NOTIFICATION_EMAIL
  const recipients = parseAdminRecipients(raw)
  if (raw && raw.trim() && recipients.length === 0 && !invalidReported) {
    invalidReported = true
    Sentry.captureMessage(
      'ADMIN_NOTIFICATION_EMAIL has no valid address; admin notification emails are skipped',
      { level: 'warning' }
    )
  }
  return recipients
}
