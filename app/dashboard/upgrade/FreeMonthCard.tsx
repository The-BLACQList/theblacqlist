import { ClaimTrialButton } from '@/components/tour/ClaimTrialButton'
import { isPlanPurchasable, type PlanAvailability } from '@/lib/stripe/availability'
import { getPlanMeta } from '@/lib/stripe/plans'
import { freeMonthTiers, type FreeMonthState } from '@/lib/tour/freeMonth'
import type { TesterTrialTier } from '@/lib/tour/trial'
import { formatFreeMonthEnd, type UpgradeStatus } from '@/lib/tour/upgrade'
import { EndFreeMonthButton } from './EndFreeMonthButton'
import { FreeMonthPagePicker, type PickablePage } from './FreeMonthPagePicker'

// The tester's free month (founder, 2026-10-10): one month free on any paid
// tier, used now or held until the tier they want opens. Nothing pushes the
// tester onto Starter; a tier that isn't open yet says so and waits.
//
// An owner who got their link before they had a page (2026-10-11) sees it
// wait until a page of theirs is live, then picks the page if they own more
// than one.
//
// A tester whose page already pays gets the month on a bigger plan: 30 days
// of it free, then back to the plan they had (ticket 136). While the month
// runs, the card says when it ends and lets them end the plan then instead.

interface Props {
  state: FreeMonthState
  availability: PlanAvailability
  /** The upgrade page's own listing, so the card can name the tester's
   *  listing when it is a different one. */
  primaryListingId: string
}

export function FreeMonthCard({ state, availability, primaryListingId }: Props) {
  return (
    <section
      id="free-month"
      aria-labelledby="free-month-heading"
      className="mb-8 scroll-mt-24 rounded-xl border border-amber-gold/50 bg-amber-gold/5 p-5"
    >
      <h2 id="free-month-heading" className="font-headline text-lg text-brand-black">
        Your free month
      </h2>
      <Body state={state} availability={availability} primaryListingId={primaryListingId} />
    </section>
  )
}

function Body({ state, availability, primaryListingId }: Props) {
  if (state.status === 'used') {
    if (state.upgrade?.running) return <UpgradeRunning upgrade={state.upgrade} />
    return (
      <p className="mt-1 font-body text-sm text-charcoal-soft">
        {state.tier
          ? `You used your free month on ${getPlanMeta(state.tier).name}. Thank you for testing.`
          : 'You used your free month. Thank you for testing.'}
      </p>
    )
  }

  if (state.status === 'waiting') {
    return (
      <p className="mt-1 max-w-xl font-body text-sm text-charcoal-soft">
        {waitingCopy(state.hasPage)}
      </p>
    )
  }

  if (state.status === 'pick') {
    const pages: PickablePage[] = state.pages.map((page) => ({
      listingId: page.listingId,
      listingName: page.listingName ?? 'Your page',
      paid: page.paid,
      tiers: tierOptions(page.currentTier, availability),
    }))
    return (
      <>
        <p className="mt-1 max-w-xl font-body text-sm text-charcoal-soft">
          Thanks for testing. You get one month free on any plan, on one of your pages. Pick the
          page first. It doesn’t expire, and you don’t need a card to start. On a page that already
          has a plan, you get 30 days of a bigger plan free, then it goes back to the plan it has.
        </p>
        <FreeMonthPagePicker pages={pages} />
      </>
    )
  }

  const forListing =
    state.listingName && state.listingId !== primaryListingId ? ` for ${state.listingName}` : ''

  const tiers = freeMonthTiers(state.currentTier)
  // Only set for an owner whose enrollment has no page yet: the claim names it.
  const attachTo = state.attach ? state.listingId : undefined

  if (state.paying && tiers.length === 0) {
    return (
      <p className="mt-1 max-w-xl font-body text-sm text-charcoal-soft">
        {`Thanks for testing. You have one month free${forListing}, and you’re already on our top plan. If you’d like it on a different page, write to support@theblacqlist.com.`}
      </p>
    )
  }

  const intro = state.paying
    ? `Thanks for testing. You get 30 days free${forListing} on a bigger plan. Your ${getPlanMeta(state.currentTier).name} billing pauses for those 30 days, then you go back to ${getPlanMeta(state.currentTier).name} at $${getPlanMeta(state.currentTier).price_monthly}/month. Use it now, or save it until the plan you want opens.`
    : `Thanks for testing. You get one month free${forListing} on any plan. Use it now, or save it until the plan you want opens. It doesn’t expire, and you don’t need a card to start.`

  return (
    <>
      <p className="mt-1 max-w-xl font-body text-sm text-charcoal-soft">{intro}</p>
      <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {tiers.map((tier) => {
          const name = getPlanMeta(tier).name
          const open = isPlanPurchasable(availability, tier, 'monthly')
          return (
            <li
              key={tier}
              className="flex flex-col rounded-lg border border-charcoal/10 bg-white p-4"
            >
              <p className="mb-3 font-subhead text-sm font-bold text-brand-black">{name}</p>
              {open ? (
                <ClaimTrialButton
                  plan={tier}
                  label={state.openTier === tier ? 'Resume checkout' : `Use it on ${name}`}
                  pendingLabel={state.paying ? 'Starting your free month…' : undefined}
                  listingId={attachTo}
                />
              ) : (
                <p className="font-body text-xs text-charcoal-faint">
                  Coming soon. Your free month will wait.
                </p>
              )}
            </li>
          )
        })}
      </ul>
    </>
  )
}

/** The month is on the page's existing plan and still running. */
function UpgradeRunning({ upgrade }: { upgrade: UpgradeStatus }) {
  const name = upgrade.tier ? getPlanMeta(upgrade.tier).name : 'your free'
  const back = upgrade.returnTier ? getPlanMeta(upgrade.returnTier) : null
  const date = upgrade.endsAt === null ? null : formatFreeMonthEnd(upgrade.endsAt)
  const ends = date ? ` until ${date}` : ''
  const after = upgrade.cancelling
    ? `Your plan ends ${date ? `on ${date}` : 'when the free month ends'}. You won’t be charged.`
    : back
      ? `${date ? `On ${date}` : 'After that'} you go back to ${back.name} at $${back.price_monthly}/month. Nothing to do if that’s what you want.`
      : 'After that you go back to the plan you had.'
  return (
    <>
      <p className="mt-1 max-w-xl font-body text-sm text-charcoal-soft">
        {`You’re on ${name} free${ends}. ${after}`}
      </p>
      <EndFreeMonthButton cancelling={upgrade.cancelling} returnTierName={back?.name ?? null} />
    </>
  )
}

/** The waiting line, shared with the dashboard home notice. */
export function waitingCopy(hasPage: boolean): string {
  return hasPage
    ? 'Your free month is saved. It will be ready here once your page is live.'
    : 'Your free month is saved. Add or claim your page, and it will be ready here once your page is live.'
}

function tierOptions(
  currentTier: Parameters<typeof freeMonthTiers>[0],
  availability: PlanAvailability
): { tier: TesterTrialTier; name: string; open: boolean }[] {
  return freeMonthTiers(currentTier).map((tier) => ({
    tier,
    name: getPlanMeta(tier).name,
    open: isPlanPurchasable(availability, tier, 'monthly'),
  }))
}
