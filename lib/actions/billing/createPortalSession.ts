'use server'

import { getAppUrl } from '@/lib/env'
import { createClient } from '@/lib/supabase/server'
import { getOwnerSession } from '@/lib/dashboard/guard'
import { stripe } from '@/lib/stripe/client'
import { checkRateLimit } from '@/lib/security/rate-limit'
import { z } from 'zod'

// A server action's argument is whatever the browser sends, so it is parsed
// like any other request body. Unknown keys are refused. The plan is the
// owner's (ticket 238), so there is nothing to choose: no input is taken.
const portalInputSchema = z.object({}).strict().optional()

const PORTAL_RATE_LIMIT = 10

export type PortalResult =
  | { ok: true; url: string }
  | {
      ok: false
      code: 'UNAUTHORIZED' | 'VALIDATION_ERROR' | 'RATE_LIMITED' | 'NO_CUSTOMER' | 'SERVER_ERROR'
      message: string
    }

/**
 * Creates a Stripe Customer Portal session so an owner can manage their
 * subscription (update payment method, switch plan, cancel) — self-service.
 *
 * Which plans the portal offers is set in the Stripe Dashboard portal
 * configuration, not here. It must list only products we sell (Starter today);
 * a switch onto a withheld tier bills the new price while the listing keeps its
 * old tier. handleSubscriptionUpsert flags that case (`price_unresolved`), but
 * the configuration is the real block.
 *
 * Ownership is enforced by querying `subscriptions` through the RLS-scoped
 * client: a user can only ever read rows where user_id = auth.uid(), so the
 * resolved stripe_customer_id always belongs to the caller.
 */
export async function createPortalSession(rawInput?: Record<string, never>): Promise<PortalResult> {
  const session = await getOwnerSession()
  if (!session) {
    return { ok: false, code: 'UNAUTHORIZED', message: 'You must be signed in.' }
  }

  const parsed = portalInputSchema.safeParse(rawInput)
  if (!parsed.success) {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'That request was not valid.' }
  }

  const allowed = await checkRateLimit({
    bucket: 'billing_portal',
    identifier: session.user.id,
    limit: PORTAL_RATE_LIMIT,
  })
  if (!allowed) {
    return {
      ok: false,
      code: 'RATE_LIMITED',
      message: 'Too many attempts. Please wait a minute and try again.',
    }
  }

  const supabase = await createClient()

  // The owner's Stripe customer: a past-due plan first (its card needs
  // updating), else the most recent one not canceled. RLS already restricts
  // this to the caller's rows. Filters must precede transforms.
  const { data: rows, error } = await supabase
    .from('subscriptions')
    .select('stripe_customer_id, status, created_at')
    .not('stripe_customer_id', 'is', null)
    .neq('status', 'canceled')
    .order('created_at', { ascending: false })
    .limit(10)

  if (error) {
    console.error('[createPortalSession] lookup failed:', error.message)
    return { ok: false, code: 'SERVER_ERROR', message: 'Could not load your subscription.' }
  }

  const sub = rows?.find((r) => r.status === 'past_due') ?? rows?.[0]
  const customerId = sub?.stripe_customer_id
  if (!customerId) {
    return {
      ok: false,
      code: 'NO_CUSTOMER',
      message: 'No active subscription to manage yet.',
    }
  }

  // getAppUrl() resolves the deployment's own origin on Preview (VERCEL_URL
  // fallback), so the portal's return_url never points at localhost.
  const baseUrl = getAppUrl()

  try {
    const portal = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${baseUrl}/dashboard/upgrade`,
    })
    return { ok: true, url: portal.url }
  } catch (err) {
    console.error('[createPortalSession] Stripe error:', err)
    return { ok: false, code: 'SERVER_ERROR', message: 'Could not open the billing portal.' }
  }
}
