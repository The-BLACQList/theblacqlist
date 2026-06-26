import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { requireOwner } from '@/lib/dashboard/guard'
import { PLANS } from '@/lib/stripe/plans'
import { cn } from '@/lib/utils'
import { CheckoutButton } from './CheckoutButton'

export const metadata: Metadata = { title: 'Upgrade | BLACQList Dashboard' }

export default async function UpgradePage() {
  await requireOwner()
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Owner's listings (need listing_id for the checkout session)
  const { data: listings } = await supabase
    .from('listings')
    .select('id, name')
    .eq('owner_user_id', user!.id)
    .is('deleted_at', null)
    .order('created_at')

  // Plans with Stripe price IDs from DB
  const { data: dbPlans } = await supabase
    .from('plans')
    .select('id, name, plan_key, stripe_price_id_monthly')
    .eq('is_active', true)
    .order('display_order')

  const dbPlanMap = Object.fromEntries(
    (dbPlans ?? []).filter((p) => p.plan_key).map((p) => [p.plan_key!, p])
  )

  // Default to the first listing
  const primaryListingId = listings?.[0]?.id ?? ''

  return (
    <div className="max-w-4xl">
      <div className="mb-8">
        <h1 className="font-headline text-2xl text-brand-black mb-2">Upgrade Your Plan</h1>
        <p className="font-body text-sm text-charcoal-soft max-w-lg">
          Unlock analytics, priority placement, and more for your listing.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {PLANS.map((plan) => {
          const dbPlan = dbPlanMap[plan.slug]
          const isPurchasable =
            plan.slug !== 'free' && !!dbPlan?.stripe_price_id_monthly && !!primaryListingId

          return (
            <div
              key={plan.slug}
              className={cn(
                'relative rounded-xl border p-5 flex flex-col',
                plan.highlighted
                  ? 'border-amber-gold/40 bg-amber-gold/5'
                  : 'border-charcoal/10 bg-white'
              )}
            >
              {plan.highlighted && (
                <span className="absolute -top-3 left-4 inline-block rounded-full bg-amber-gold text-brand-black text-xs font-subhead font-bold px-3 py-0.5">
                  Most Popular
                </span>
              )}

              <div className="mb-3">
                <h3 className="font-headline text-lg text-brand-black mb-1">{plan.name}</h3>
                <div className="flex items-baseline gap-1">
                  <span className="font-headline text-2xl text-brand-black">
                    ${plan.price_monthly}
                  </span>
                  <span className="font-subhead text-xs text-charcoal-faint">
                    {plan.price_monthly === 0 ? 'forever' : '/mo'}
                  </span>
                </div>
              </div>

              <ul className="space-y-1.5 mb-5 flex-1">
                {plan.features.map((f) => (
                  <li
                    key={f}
                    className="flex items-start gap-1.5 font-subhead text-xs text-charcoal-soft"
                  >
                    <span
                      className="mt-[5px] h-1 w-1 shrink-0 rounded-full bg-amber-gold"
                      aria-hidden="true"
                    />
                    {f}
                  </li>
                ))}
              </ul>

              {plan.slug === 'free' ? (
                <div className="h-10 flex items-center">
                  <span className="font-subhead text-xs text-charcoal-faint">Your current plan</span>
                </div>
              ) : isPurchasable ? (
                <CheckoutButton
                  planSlug={plan.slug}
                  listingId={primaryListingId}
                  label={plan.cta}
                  highlighted={plan.highlighted}
                />
              ) : (
                <button
                  disabled
                  className="w-full h-10 rounded-full bg-charcoal/10 text-charcoal-faint font-body font-bold text-sm cursor-not-allowed"
                  aria-label={`${plan.name} — coming soon`}
                >
                  Coming Soon
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
