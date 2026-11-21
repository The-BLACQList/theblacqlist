import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { requireOwner } from '@/lib/dashboard/guard'
import { getPlanAvailability } from '@/lib/stripe/availability'
import type { PlanSlug } from '@/lib/stripe/plans'
import { getFreeMonthState } from '@/lib/tour/freeMonth'
import { getOwnerPlan } from '@/lib/services/billing/ownerPlan'
import { freeMonthHold } from '@/lib/tour/freeMonthHold'
import { FreeMonthCard } from './FreeMonthCard'
import { UpgradePlans } from './UpgradePlans'

export const metadata: Metadata = { title: 'Upgrade | BLACQList Dashboard' }

const UNCOVERABLE = new Set(['job', 'event'])

export default async function UpgradePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  await requireOwner()
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const { page: pageParam } = await searchParams

  const { data: listings } = await supabase
    .from('listings')
    .select('id, name, tier, entity_type')
    .eq('owner_user_id', user!.id)
    .is('deleted_at', null)
    .order('created_at')

  // Ticket 238: the plan is the owner's. A checkout starts it on the page the
  // owner came from (?page=), else their oldest page; job and event pages are
  // paid for on their own and never anchor a plan.
  const coverable = (listings ?? []).filter((l) => !UNCOVERABLE.has(l.entity_type))
  const primaryListingId =
    (coverable.find((l) => l.id === pageParam) ?? coverable[0])?.id ?? ''

  // Which plans have Stripe price IDs configured, per cycle. Shared with the
  // public /pricing page so the two surfaces cannot disagree about what is for sale.
  // A tester who finished the walk sees their free month first. Null for
  // everyone else, and on any read failure (the card hides, plans still show).
  const [availability, freeMonth, ownerPlan] = await Promise.all([
    getPlanAvailability(supabase),
    getFreeMonthState(),
    getOwnerPlan(supabase, user!.id, listings ?? []),
  ])
  const currentTier: PlanSlug = ownerPlan.tier
  const canManage = ownerPlan.canManage

  return (
    <div className="max-w-4xl">
      <div className="mb-8">
        <h1 className="font-headline text-2xl text-brand-black mb-2">Upgrade Your Plan</h1>
        <p className="font-body text-sm text-charcoal-soft max-w-lg">
          Unlock analytics, priority placement, and more for your pages. Pay monthly or save with
          annual billing.
        </p>
      </div>

      {freeMonth && (
        <FreeMonthCard
          state={freeMonth}
          availability={availability}
          primaryListingId={primaryListingId}
        />
      )}

      <UpgradePlans
        primaryListingId={primaryListingId}
        currentTier={currentTier}
        canManage={canManage}
        availability={availability}
        freeMonthHold={freeMonthHold(freeMonth)}
      />
    </div>
  )
}
