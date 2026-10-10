// The tester's free month: who can claim it, and what the upgrade page shows.
//
// [Decision — founder, 2026-10-10] A tester who finishes the walk gets one
// free month on any paid tier, and can hold it for as long as they like. They
// are never pushed onto Starter just because Starter is the only tier open
// today. Three answers shape this file:
//
//   1. Only owner testers who finish the walk get it (completed_at is set and
//      the enrollment has a listing).
//   2. A tester already paying for Starter keeps the free month for a bigger
//      plan later. Putting it on an existing subscription is ticket 136; until
//      then the claim route refuses without spending the claim, and the card
//      says it is saved.
//   3. The free month outlives the tour. Switching FEATURE_TESTER_TOUR off
//      removes the rail, not the claim, so nothing here reads the flag.
//
// "Held" needs no new column: an unclaimed enrollment (trial_granted_at null)
// never expires. Ending an enrollment (ended_at) is an admin decision and does
// close it, the same as it closes the tour.

import { cache } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { stripe } from '@/lib/stripe/client'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import type { TourViewer } from '@/lib/tour/witness'
import { isTesterTrialTier, TESTER_TRIAL_TIERS, type TesterTrialTier } from '@/lib/tour/trial'
import type { PlanSlug } from '@/lib/stripe/plans'

// Statuses that still hold paid access (mirrors KEEPS_ACCESS in
// lib/services/billing/webhookHandlers.ts).
export const LIVE_STATUSES = ['active', 'trialing', 'past_due']

/**
 * The signed-in user's live enrollment, whatever FEATURE_TESTER_TOUR says.
 *
 * Same shape and same "null means nothing to show" collapse as
 * resolveTourViewer, minus the flag check (answer 3 above). Kept separate so
 * the tour's page witnesses and rail still switch off with the flag.
 */
export const resolveTrialClaimer = cache(async (): Promise<TourViewer | null> => {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return null

    const { data: enrollment, error } = await supabase
      .from('tour_enrollments')
      .select('id, listing_id, completed_at, trial_granted_at')
      .eq('tester_user_id', user.id)
      .is('ended_at', null)
      .maybeSingle()
    if (error || !enrollment) return null

    return {
      userId: user.id,
      email: user.email ?? null,
      enrollment: {
        id: enrollment.id,
        listingId: enrollment.listing_id,
        completedAt: enrollment.completed_at,
        trialGrantedAt: enrollment.trial_granted_at,
      },
    }
  } catch {
    return null
  }
})

export type FreeMonthState =
  | {
      /** Ready to use. `openTier` is set when a checkout from an earlier
       *  click is still open, so that tier's button can say "Resume". */
      status: 'ready'
      listingId: string
      listingName: string | null
      currentTier: PlanSlug
      openTier: TesterTrialTier | null
    }
  | {
      /** The checkout went through; the month is in use or done. */
      status: 'used'
      tier: TesterTrialTier | null
    }
  | {
      /** The listing already pays, so the month waits for an upgrade
       *  (ticket 136). */
      status: 'saved'
      listingId: string
      listingName: string | null
      currentTier: PlanSlug
    }

/**
 * What the upgrade page's free-month card shows, or null for no card.
 *
 * Null covers: not a tester, a supporter tester, and a walk not finished. A
 * read failure also returns
 * null; the card is an offer, and hiding it for one page load is better than
 * showing a button the claim route would refuse.
 */
export async function getFreeMonthState(): Promise<FreeMonthState | null> {
  const viewer = await resolveTrialClaimer()
  if (!viewer) return null
  const { listingId, completedAt, trialGrantedAt } = viewer.enrollment
  if (listingId === null || completedAt === null) return null

  try {
    const service = createServiceClient() as unknown as SupabaseClient

    let openTier: TesterTrialTier | null = null
    if (trialGrantedAt !== null) {
      const { data: row, error } = await service
        .from('tour_enrollments')
        .select('stripe_checkout_session_id')
        .eq('id', viewer.enrollment.id)
        .maybeSingle()
      if (error || !row) return null
      const sessionId = (row as { stripe_checkout_session_id: string | null })
        .stripe_checkout_session_id
      if (sessionId !== null) {
        const session = await stripe.checkout.sessions.retrieve(sessionId)
        const slug = session.metadata?.plan_slug
        const tier = isTesterTrialTier(slug) ? slug : null
        if (session.status === 'complete') return { status: 'used', tier }
        if (session.status === 'open') openTier = tier
      }
    }

    const [{ data: listing }, { data: subs, error: subsError }] = await Promise.all([
      service.from('listings').select('name, tier').eq('id', listingId).maybeSingle(),
      service
        .from('subscriptions')
        .select('id')
        .eq('listing_id', listingId)
        .in('status', LIVE_STATUSES)
        .limit(1),
    ])
    if (subsError) return null

    const row = listing as { name: string | null; tier: string | null } | null
    const currentTier = (row?.tier ?? 'free') as PlanSlug
    const listingName = row?.name ?? null

    if ((subs?.length ?? 0) > 0) {
      return { status: 'saved', listingId, listingName, currentTier }
    }
    return { status: 'ready', listingId, listingName, currentTier, openTier }
  } catch {
    return null
  }
}

/** The tiers the card offers: every paid tier above the listing's current one. */
export function freeMonthTiers(currentTier: PlanSlug): TesterTrialTier[] {
  const order: PlanSlug[] = ['free', ...TESTER_TRIAL_TIERS]
  const rank = order.indexOf(currentTier)
  return TESTER_TRIAL_TIERS.filter((t) => order.indexOf(t) > rank)
}
