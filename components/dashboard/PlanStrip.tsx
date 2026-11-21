import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { getPlanMeta } from '@/lib/stripe/plans'
import type { OwnerPlan } from '@/lib/services/billing/ownerPlan'
import { ManageSubscriptionButton } from '@/app/dashboard/upgrade/ManageSubscriptionButton'

// Ticket 237: the owner's plan at the top of the dashboard home (founder pick
// 2026-11-21: one strip, Payment Due as its only extra state). Outlined in
// amber-gold: light-gold and gold belong to the Verified and Certified marks,
// so a plan never reads as a trust signal.

const FREE_HINT = 'Upgrade to Starter for analytics, review replies and more photos.'
const DUE_HINT = "Your last payment didn't go through. Update your card to keep your plan."

export function PlanStrip({ plan }: { plan: OwnerPlan }) {
  const meta = getPlanMeta(plan.tier)
  const isFree = plan.tier === 'free'
  const due = plan.paymentDue && !isFree

  return (
    <section
      aria-labelledby="plan-strip-heading"
      data-plan={plan.tier}
      data-payment-due={due ? 'true' : undefined}
      className={`rounded-xl border p-4 sm:px-5 flex flex-col sm:flex-row sm:items-center gap-3 ${
        due ? 'border-red-300 bg-red-50' : 'border-amber-gold/60 bg-amber-gold/5'
      }`}
    >
      <div className="min-w-0">
        <p className="font-subhead text-xs font-semibold uppercase tracking-wide text-charcoal-soft">
          Your Plan
        </p>
        <div className="mt-0.5 flex flex-wrap items-center gap-2">
          <h2 id="plan-strip-heading" className="font-headline text-lg text-brand-black">
            {meta.name} Plan
          </h2>
          {due && (
            <span className="inline-block rounded-full bg-red-100 px-2 py-0.5 font-subhead text-xs font-semibold text-red-700">
              Payment Due
            </span>
          )}
        </div>
        <p className="mt-0.5 font-body text-sm text-charcoal-soft">
          {due ? DUE_HINT : isFree ? FREE_HINT : meta.tagline}
        </p>
        {plan.coverage && (
          <Link
            href="/dashboard/upgrade#plan-pages"
            data-plan-coverage
            className="mt-1 inline-flex items-center gap-1 font-subhead text-sm font-semibold text-amber hover:underline"
          >
            {coverageLabel(plan.coverage)} <ChevronRight className="size-4" aria-hidden="true" />
          </Link>
        )}
      </div>

      <div className="sm:ml-auto shrink-0">
        {isFree ? (
          <Link
            href="/dashboard/upgrade"
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-amber-gold px-5 font-body text-sm font-bold text-brand-black transition-colors hover:bg-light-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-gold focus-visible:ring-offset-2"
          >
            See Plans <ChevronRight className="size-4" aria-hidden="true" />
          </Link>
        ) : plan.canManage ? (
          <ManageSubscriptionButton
            label={due ? 'Update Card' : 'Manage Subscription'}
          />
        ) : (
          <Link
            href="/dashboard/upgrade"
            className="inline-flex min-h-[44px] items-center gap-1.5 font-subhead text-sm font-semibold text-amber hover:underline"
          >
            Compare Plans <ChevronRight className="size-4" aria-hidden="true" />
          </Link>
        )}
      </div>
    </section>
  )
}

/** "2 of 3 Pages Covered" (ticket 238). Title Case: it's a link label. */
export function coverageLabel({ count, cap }: { count: number; cap: number }): string {
  return `${count} of ${cap} ${cap === 1 ? 'Page' : 'Pages'} Covered`
}

/** The small plan tag in each page card's header. */
export function PagePlanTag({ tier }: { tier: string | null }) {
  const slug = (['free', 'starter', 'growth', 'premium'] as const).find((s) => s === tier) ?? 'free'
  return (
    <span
      data-plan-tag={slug}
      className="inline-block rounded-full border border-amber-gold/60 px-2 py-0.5 font-subhead text-xs text-brand-black"
    >
      {getPlanMeta(slug).name} Plan
    </span>
  )
}
