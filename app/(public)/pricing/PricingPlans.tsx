'use client'

import { useState } from 'react'
import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { BillingCycleToggle } from '@/components/billing/BillingCycleToggle'
import { isPlanPurchasable, type PlanAvailability } from '@/lib/stripe/availability'
import { PLANS, annualSavingsPct, type BillingCycle } from '@/lib/stripe/plans'

// Free links to the free-signup path; paid tiers route through sign-in to the
// dashboard upgrade page where the live Stripe checkout lives.
const CTA_HREF: Record<string, string> = {
  free: '/for-business',
  starter: '/sign-in?next=/dashboard/upgrade',
  growth: '/sign-in?next=/dashboard/upgrade',
  premium: '/sign-in?next=/dashboard/upgrade',
}

// `availability` comes from the live `plans` table via the server component, so
// this page and /dashboard/upgrade cannot disagree about what is for sale. A
// tier with no Stripe price ID renders as an inert Coming Soon button — sending
// a visitor through sign-in to a disabled upgrade button was the exact dead end
// the launch truth pass exists to remove.
export function PricingPlans({ availability }: { availability: PlanAvailability }) {
  const [cycle, setCycle] = useState<BillingCycle>('monthly')
  const starter = PLANS.find((p) => p.slug === 'starter')!
  const savingsPct = annualSavingsPct(starter)

  return (
    <div className="mt-8">
      <div className="flex justify-center mb-8">
        <BillingCycleToggle
          value={cycle}
          onChange={setCycle}
          annualBadge={savingsPct > 0 ? `Save ${savingsPct}%` : undefined}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 max-w-6xl mx-auto">
        {PLANS.map((plan) => {
          const isFree = plan.slug === 'free'
          const price = isFree ? '$0' : cycle === 'annual' ? `$${plan.price_yearly}` : `$${plan.price_monthly}`
          const period = isFree ? 'forever' : cycle === 'annual' ? '/yr' : '/mo'
          const comingSoon = !isFree && !isPlanPurchasable(availability, plan.slug, cycle)
          // "Most Popular" on a tier nobody can buy is the same dishonesty as a
          // live CTA on it. Growth carries the flag in lib/stripe/plans.ts and is
          // the tier most likely to be withheld, so this is load-bearing.
          const featured = plan.highlighted && !comingSoon

          return (
            <div
              key={plan.slug}
              className={`relative flex flex-col rounded-xl border p-6 ${
                featured ? 'border-amber-gold ring-1 ring-amber-gold' : 'border-charcoal/15'
              }`}
            >
              {featured && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 inline-block rounded-full bg-amber-gold text-brand-black text-xs font-subhead font-bold px-3 py-1 whitespace-nowrap">
                  Most Popular
                </span>
              )}

              <div className="mb-4">
                <h3 className="font-headline text-xl text-brand-black mb-1">{plan.name}</h3>
                <p className="font-subhead text-xs text-charcoal-soft mb-3">{plan.tagline}</p>
                <div className="flex items-baseline gap-1">
                  <span className="font-headline text-3xl text-brand-black">{price}</span>
                  <span className="font-subhead text-sm text-charcoal-soft">{period}</span>
                </div>
                {!isFree && cycle === 'annual' && (
                  <p className="font-subhead text-xs text-amber mt-1">2 months free</p>
                )}
              </div>

              <ul className="space-y-2 mb-6 flex-1">
                {plan.features.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-start gap-2 font-subhead text-sm text-charcoal"
                  >
                    <span
                      className="mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full bg-amber-gold"
                      aria-hidden="true"
                    />
                    {feature}
                  </li>
                ))}
              </ul>

              {comingSoon ? (
                <div className="space-y-2">
                  {/* Mirrors app/dashboard/upgrade/UpgradePlans.tsx:127-134 so the
                      two surfaces render the withheld state identically. Disabled
                      rather than hidden: the tier is real and coming, and hiding
                      it would make the roadmap invisible. */}
                  <button
                    disabled
                    className="w-full min-h-[44px] h-auto rounded-full bg-charcoal/10 text-charcoal-faint font-body font-bold text-sm cursor-not-allowed"
                    aria-label={`${plan.name}, coming soon`}
                  >
                    Coming Soon
                  </button>
                  <a
                    href="#pricing-waitlist"
                    className="block text-center font-subhead text-xs text-charcoal underline underline-offset-2 hover:text-brand-black"
                  >
                    Tell us you want {plan.name}
                  </a>
                </div>
              ) : (
                <Button
                  asChild
                  className={`w-full rounded-full font-body font-bold min-h-[44px] h-auto text-sm ${
                    featured
                      ? 'bg-amber-gold text-brand-black hover:bg-light-gold'
                      : isFree
                        ? 'bg-brand-black text-white hover:bg-charcoal'
                        : 'border border-brand-black bg-white text-brand-black hover:bg-brand-black hover:text-white transition-colors'
                  }`}
                >
                  <Link href={CTA_HREF[plan.slug] ?? '/for-business'}>{plan.cta}</Link>
                </Button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
