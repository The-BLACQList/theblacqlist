'use server'

import { createHash } from 'node:crypto'
import { headers } from 'next/headers'
import { after } from 'next/server'

import { SERVER_ONLY_EVENTS } from '@/lib/analytics/constants'
import { trackServerEvent } from '@/lib/analytics/server'
import { SUBSCRIBE_ERRORS } from '@/lib/actions/subscribers/subscribeErrors'
import { sendLaunchConfirmation } from '@/lib/email/sendLaunchConfirmation'
import { SUBSCRIBE_RATE_LIMIT_SALT } from '@/lib/env'
import {
  attributionFromFormData,
  parseSignupRole,
  type LaunchAttribution,
  type SignupRole,
} from '@/lib/marketing/launch-attribution'
import { isHoneypotTripped } from '@/lib/security/honeypot'
import { verifyTurnstileFormData } from '@/lib/security/turnstile'
import { createServiceClient } from '@/lib/supabase/server'

export type SubscribeState = { error: string } | { success: true } | null

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

// `launch_subscribers.source` is unconstrained text written by the service-role
// client, so the allowlist has to live here — passing a raw client string
// through would let anyone write anything into the column the founder reads to
// decide what to build next. Anything unrecognized falls back to the default
// rather than being rejected: a mislabeled signup is still a signup.
const DEFAULT_SOURCE = 'coming-soon'
const ALLOWED_SOURCES = new Set([
  DEFAULT_SOURCE,
  'pricing-growth',
  'pricing-premium',
  'pricing-addons',
  // /for-vendors. The marketplace requires the Growth tier, which is not for
  // sale (decision D-M, 2026-09-01), so the page captures vendor interest
  // instead of routing to a checkout that would 422.
  'for-vendors',
])

// Durable throttle. This action is unauthenticated and writes with the
// service-role client, so without a limit anyone can drive unbounded inserts
// into launch_subscribers. The ledger lives in Postgres rather than an in-memory
// Map (the pattern used in app/api/search/route.ts) because on Vercel a Map
// resets on every cold start and is not shared across concurrent instances — it
// bounds nothing in practice.
const RATE_LIMIT_MAX = 5
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000

// Same resolution order as app/api/search/route.ts:13-15.
async function getClientIp(): Promise<string> {
  const h = await headers()
  const forwarded = h.get('x-forwarded-for') ?? ''
  return (forwarded.split(',')[0] ?? '').trim() || h.get('x-real-ip') || 'unknown'
}

// The raw IP never leaves this function and is never stored or logged
// (.claude/rules/data-privacy.md).
function hashIp(ip: string): string {
  return createHash('sha256').update(`${SUBSCRIBE_RATE_LIMIT_SALT}${ip}`).digest('hex')
}

// ── Attribution columns (pre-launch R2 / R3) ─────────────────────────────────
// utm_source, utm_medium, utm_campaign, utm_content, referrer and signup_role
// are added by supabase/migrations/20261004000000_launch_subscribers_attribution.sql.
// The code merge (GATE-DEPLOY) and that migration (GATE-DATA) are separate
// decisions, so this action has to work on a table that does not have them yet.
//
// Two things make that true:
//   1. Only non-null values are sent. A signup with no UTMs and no role posts
//      exactly { email, source }, which the old table accepts.
//   2. If the insert is rejected because a column is missing, it is retried
//      once with { email, source } alone. The signup is kept; the attribution
//      for that one row is lost, and a warning says why.
//
// PGRST204: PostgREST "could not find the column in the schema cache".
// 42703:    Postgres undefined_column, if the request ever reaches the database.
const MISSING_COLUMN_CODES = new Set(['PGRST204', '42703'])

let missingColumnWarned = false

type AttributionColumns = Partial<Record<keyof LaunchAttribution | 'signup_role', string>>

function attributionColumns(
  attribution: LaunchAttribution,
  role: SignupRole | null
): AttributionColumns {
  const columns: AttributionColumns = {}
  for (const key of Object.keys(attribution) as (keyof LaunchAttribution)[]) {
    const value = attribution[key]
    if (value) columns[key] = value
  }
  if (role) columns.signup_role = role
  return columns
}

export async function subscribeLaunchAction(
  _prev: SubscribeState,
  formData: FormData
): Promise<SubscribeState> {
  // A bot that filled the hidden field sees the normal success message, and
  // nothing is written, not even an attempt row.
  if (isHoneypotTripped(formData)) return { success: true }

  // The ledger below fails open, so Turnstile is what still stands when the
  // ledger is down. It fails closed once TURNSTILE_SECRET_KEY is set.
  if (!(await verifyTurnstileFormData(formData))) {
    return { error: SUBSCRIBE_ERRORS.TURNSTILE }
  }

  const supabase = createServiceClient()
  const ipHash = hashIp(await getClientIp())
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString()

  // Count first, reject at the limit WITHOUT writing a row. Table growth under a
  // sustained attack is therefore bounded at RATE_LIMIT_MAX rows per IP per
  // window, instead of one row per request.
  const { count, error: countError } = await supabase
    .from('launch_subscribe_attempts')
    .select('id', { count: 'exact', head: true })
    .eq('ip_hash', ipHash)
    .gte('attempted_at', windowStart)

  // Fail OPEN if the ledger itself is unreachable. The code merge (GATE-DEPLOY)
  // and the migration (GATE-DATA) are separate decisions, so there is a window
  // where this runs before launch_subscribe_attempts exists. A limiter outage
  // must not take the capture form down with it.
  if (!countError && (count ?? 0) >= RATE_LIMIT_MAX) {
    return { error: SUBSCRIBE_ERRORS.RATE_LIMITED }
  }

  // Record the attempt before validating, so malformed submissions still consume
  // budget — otherwise the limit is trivially bypassed by sending garbage.
  if (!countError) {
    await supabase.from('launch_subscribe_attempts').insert({ ip_hash: ipHash })
  }

  const email = formData.get('email')?.toString().trim().toLowerCase() ?? ''

  if (!email) return { error: SUBSCRIBE_ERRORS.MISSING_EMAIL }
  if (email.length > 254 || !EMAIL_RE.test(email)) {
    return { error: SUBSCRIBE_ERRORS.INVALID_EMAIL }
  }

  const rawSource = formData.get('source')?.toString() ?? DEFAULT_SOURCE
  const source = ALLOWED_SOURCES.has(rawSource) ? rawSource : DEFAULT_SOURCE

  // Re-validated here whatever the browser posted: UTM values to a short
  // plain character set, the referrer to its origin, the role to one of two.
  const attribution = attributionFromFormData(formData)
  const role = parseSignupRole(formData.get('signup_role')?.toString())
  const extra = attributionColumns(attribution, role)

  let { error } = await supabase.from('launch_subscribers').insert({ email, source, ...extra })

  if (error && MISSING_COLUMN_CODES.has(error.code) && Object.keys(extra).length > 0) {
    if (!missingColumnWarned) {
      missingColumnWarned = true
      console.warn(
        '[subscribeLaunch] launch_subscribers has no attribution columns yet ' +
          '(migration 20261004000000 not applied). Saving the signup without them.'
      )
    }
    ;({ error } = await supabase.from('launch_subscribers').insert({ email, source }))
  }

  if (error) {
    // A repeat subscriber is told they are on the list, not that they already
    // were — the form must not become an enumeration oracle.
    if (error.code === '23505') {
      // `email` is UNIQUE across the whole table, so someone already on the
      // coming-soon list who now asks about a specific tier would otherwise have
      // that interest silently dropped, and the founder would under-count demand
      // for the thing they are deciding whether to build. Promote the generic
      // row to the specific interest — guarded on the old value, so one tier
      // interest never overwrites another.
      //
      // ⚠ Known limitation: a second, different tier interest from the same
      // address is not recorded. Capturing every interest needs either a
      // separate interests table or a relaxed UNIQUE, and neither is worth a
      // migration for a waitlist this size.
      if (source !== DEFAULT_SOURCE) {
        await supabase
          .from('launch_subscribers')
          .update({ source })
          .eq('email', email)
          .eq('source', DEFAULT_SOURCE)
      }
      // A repeat signup that now says who they are fills in a role that was
      // never given. Guarded on null so it never overwrites an earlier answer,
      // and best-effort: before the migration the column does not exist and
      // the error is ignored. UTM values are first-touch and are not updated.
      if (role) {
        await supabase
          .from('launch_subscribers')
          .update({ signup_role: role })
          .eq('email', email)
          .is('signup_role', null)
      }
      return { success: true }
    }
    return { error: SUBSCRIBE_ERRORS.SERVER }
  }

  // ── A new row was written ──────────────────────────────────────────────────
  // launch_list_submit_success (R6) is server-side so a browser cannot inflate
  // the count. No email in the properties; the referrer is an origin only.
  trackServerEvent({
    event_name: SERVER_ONLY_EVENTS.LAUNCH_LIST_SUBMIT_SUCCESS,
    properties: { source, ...attribution, role },
  })

  // W0 confirmation, coming-soon signups only: its copy is about the launch
  // list, not the tier waitlists on /pricing and /for-vendors. Off unless
  // LAUNCH_CONFIRMATION_EMAIL_ENABLED is 'true' (see sendLaunchConfirmation).
  // Runs after the response so a slow email API never delays the form.
  if (source === DEFAULT_SOURCE) {
    after(() => sendLaunchConfirmation(email))
  }

  return { success: true }
}
