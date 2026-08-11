'use server'

import { createHash } from 'node:crypto'
import { headers } from 'next/headers'

import { SUBSCRIBE_RATE_LIMIT_SALT } from '@/lib/env'
import { createServiceClient } from '@/lib/supabase/server'

export type SubscribeState = { error: string } | { success: true } | null

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

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

export async function subscribeLaunchAction(
  _prev: SubscribeState,
  formData: FormData
): Promise<SubscribeState> {
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
    return { error: 'Too many attempts. Please try again in a few minutes.' }
  }

  // Record the attempt before validating, so malformed submissions still consume
  // budget — otherwise the limit is trivially bypassed by sending garbage.
  if (!countError) {
    await supabase.from('launch_subscribe_attempts').insert({ ip_hash: ipHash })
  }

  const email = formData.get('email')?.toString().trim().toLowerCase() ?? ''

  if (!email) return { error: 'Please enter your email address.' }
  if (email.length > 254 || !EMAIL_RE.test(email)) {
    return { error: 'Please enter a valid email address.' }
  }

  const { error } = await supabase
    .from('launch_subscribers')
    .insert({ email, source: 'coming-soon' })

  if (error) {
    // A repeat subscriber is told they are on the list, not that they already
    // were — the form must not become an enumeration oracle.
    if (error.code === '23505') return { success: true }
    return { error: 'Something went wrong. Please try again.' }
  }

  return { success: true }
}
