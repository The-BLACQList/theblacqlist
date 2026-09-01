'use client'

import { useState } from 'react'

import { cn } from '@/lib/utils'
import {
  PLANS,
  annualSavingsPct,
  type BillingCycle,
  type PlanSlug,
} from '@/lib/stripe/plans'
import { isPlanPurchasable, type PlanAvailability } from '@/lib/stripe/availability'
import { BillingCycleToggle } from '@/components/billing/BillingCycleToggle'
import { CheckoutButton } from './CheckoutButton'
import { ManageSubscriptionButton } from './ManageSubscriptionButton'

interface Props {
  primaryListingId: string
  currentTier: PlanSlug
  canManage: boolean
  // Per paid plan, whether a Stripe price ID exists for each cycle.
  availability: PlanAvailability
}

const TIER_ORDER: PlanSlug[] = ['free', 'starter', 'growth', 'premium']

export function UpgradePlans({ primaryListingId, currentTier, canManage, availability }: Props) {
  const [cycle, setCycle] = useState<BillingCycle>('monthly')
  const starter = PLANS.find((p) => p.slug === 'starter')!
  const savingsPct = annualSavingsPct(starter)
  const currentRank = TIER_ORDER.indexOf(currentTier)

  return (
    <div>
      <div className="mb-6">
        <BillingCycleToggle
          value={cycle}
          onChange={setCycle}
          annualBadge={savingsPct > 0 ? `Save ${savingsPct}%` : undefined}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {PLANS.map((plan) => {
          const isFree = plan.slug === 'free'
          const rank = TIER_ORDER.indexOf(plan.slug)
          const isCurrent = plan.slug === currentTier
          const isUpgrade = rank > currentRank
          // Same derivation /pricing uses — one helper, so the two surfaces
          // cannot drift into disagreeing about what is for sale.
          const hasPrice = isPlanPurchasable(availability, plan.slug, cycle)
          const isPurchasable = isUpgrade && hasPrice && !!primaryListingId

          const price = isFree
            ? '$0'
            : cycle === 'annual'
              ? `$${plan.price_yearly}`
              : `$${plan.price_monthly}`
          const period = isFree ? 'forever' : cycle === 'annual' ? '/yr' : '/mo'

          return (
            <div
              key={plan.slug}
              className={cn(
                'relative rounded-xl border p-5 flex flex-col',
                isCurrent
                  ? 'border-amber-gold ring-1 ring-amber-gold bg-amber-gold/5'
                  : plan.highlighted
                    ? 'border-amber-gold/40 bg-amber-gold/5'
                    : 'border-charcoal/10 bg-white'
              )}
            >
              {isCurrent ? (
                <span className="absolute -top-3 left-4 inline-block rounded-full bg-amber-gold text-brand-black text-xs font-subhead font-bold px-3 py-0.5">
                  Current plan
                </span>
              ) : (
                plan.highlighted && (
                  <span className="absolute -top-3 left-4 inline-block rounded-full bg-amber-gold text-brand-black text-xs font-subhead font-bold px-3 py-0.5">
                    Most Popular
                  </span>
                )
              )}

              <div className="mb-3">
                <h3 className="font-headline text-lg text-brand-black mb-1">{plan.name}</h3>
                <div className="flex items-baseline gap-1">
                  <span className="font-headline text-2xl text-brand-black">{price}</span>
                  <span className="font-subhead text-xs text-charcoal-faint">{period}</span>
                </div>
                {!isFree && cycle === 'annual' && (
                  <p className="font-subhead text-xs text-amber mt-0.5">2 months free</p>
                )}
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

              {isCurrent ? (
                <div className="flex flex-col gap-2">
                  <span className="font-subhead text-xs text-charcoal-faint">Your current plan</span>
                  {!isFree && canManage && (
                    <ManageSubscriptionButton listingId={primaryListingId} />
                  )}
                </div>
              ) : isPurchasable ? (
                <CheckoutButton
                  planSlug={plan.slug}
                  listingId={primaryListingId}
                  label={plan.cta}
                  highlighted={plan.highlighted}
                  billingCycle={cycle}
                />
              ) : isUpgrade ? (
                <button
                  disabled
                  className="w-full h-10 rounded-full bg-charcoal/10 text-charcoal-faint font-body font-bold text-sm cursor-not-allowed"
                  aria-label={`${plan.name}, coming soon`}
                >
                  Coming Soon
                </button>
              ) : (
                <span className="font-subhead text-xs text-charcoal-faint">
                  Included in your plan
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
