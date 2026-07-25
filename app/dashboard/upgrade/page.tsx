import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { requireOwner } from '@/lib/dashboard/guard'
import type { PlanSlug } from '@/lib/stripe/plans'
import { UpgradePlans } from './UpgradePlans'

export const metadata: Metadata = { title: 'Upgrade | BLACQList Dashboard' }

export default async function UpgradePage() {
  await requireOwner()
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Owner's listings (need listing_id + current tier for checkout / highlighting)
  const { data: listings } = await supabase
    .from('listings')
    .select('id, name, tier')
    .eq('owner_user_id', user!.id)
    .is('deleted_at', null)
    .order('created_at')

  const primaryListing = listings?.[0]
  const primaryListingId = primaryListing?.id ?? ''
  const currentTier = (primaryListing?.tier ?? 'free') as PlanSlug

  // Which plans have Stripe price IDs configured, per cycle.
  const { data: dbPlans } = await supabase
    .from('plans')
    .select('plan_key, stripe_price_id_monthly, stripe_price_id_yearly')
    .eq('is_active', true)

  const availability: Record<string, { monthly: boolean; annual: boolean }> = {}
  for (const p of dbPlans ?? []) {
    if (!p.plan_key) continue
    availability[p.plan_key] = {
      monthly: !!p.stripe_price_id_monthly,
      annual: !!p.stripe_price_id_yearly,
    }
  }

  // Does the primary listing have a manageable subscription (portal target)?
  let canManage = false
  if (primaryListingId) {
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('status, stripe_customer_id')
      .eq('listing_id', primaryListingId)
      .not('stripe_customer_id', 'is', null)
      .in('status', ['active', 'past_due', 'trialing'])
      .maybeSingle()
    canManage = !!sub
  }

  return (
    <div className="max-w-4xl">
      <div className="mb-8">
        <h1 className="font-headline text-2xl text-brand-black mb-2">Upgrade Your Plan</h1>
        <p className="font-body text-sm text-charcoal-soft max-w-lg">
          Unlock analytics, priority placement, and more for your listing. Pay monthly or save with
          annual billing.
        </p>
      </div>

      <UpgradePlans
        primaryListingId={primaryListingId}
        currentTier={currentTier}
        canManage={canManage}
        availability={availability}
      />
    </div>
  )
}
