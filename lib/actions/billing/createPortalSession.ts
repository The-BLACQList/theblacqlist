'use server'

import { createClient } from '@/lib/supabase/server'
import { getOwnerSession } from '@/lib/dashboard/guard'
import { stripe } from '@/lib/stripe/client'

export type PortalResult =
  | { ok: true; url: string }
  | { ok: false; code: 'UNAUTHORIZED' | 'NO_CUSTOMER' | 'SERVER_ERROR'; message: string }

/**
 * Creates a Stripe Customer Portal session so an owner can manage their
 * subscription (update payment method, switch plan, cancel) — self-service.
 *
 * Ownership is enforced by querying `subscriptions` through the RLS-scoped
 * client: a user can only ever read rows where user_id = auth.uid(), so the
 * resolved stripe_customer_id always belongs to the caller.
 */
export async function createPortalSession(input?: {
  listingId?: string
}): Promise<PortalResult> {
  const session = await getOwnerSession()
  if (!session) {
    return { ok: false, code: 'UNAUTHORIZED', message: 'You must be signed in.' }
  }

  const supabase = await createClient()

  // Most recent non-canceled subscription with a Stripe customer, optionally
  // scoped to one listing. RLS already restricts this to the caller's rows.
  // Filters (.eq/.not/.neq) must precede transforms (.order/.limit).
  let filter = supabase
    .from('subscriptions')
    .select('stripe_customer_id, listing_id, created_at')
    .not('stripe_customer_id', 'is', null)
    .neq('status', 'canceled')

  if (input?.listingId) {
    filter = filter.eq('listing_id', input.listingId)
  }

  const { data: sub, error } = await filter
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('[createPortalSession] lookup failed:', error.message)
    return { ok: false, code: 'SERVER_ERROR', message: 'Could not load your subscription.' }
  }

  const customerId = sub?.stripe_customer_id
  if (!customerId) {
    return {
      ok: false,
      code: 'NO_CUSTOMER',
      message: 'No active subscription to manage yet.',
    }
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

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
