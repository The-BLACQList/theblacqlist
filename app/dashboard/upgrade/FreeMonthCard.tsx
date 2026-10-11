import { ClaimTrialButton } from '@/components/tour/ClaimTrialButton'
import { isPlanPurchasable, type PlanAvailability } from '@/lib/stripe/availability'
import { getPlanMeta } from '@/lib/stripe/plans'
import { freeMonthTiers, type FreeMonthState } from '@/lib/tour/freeMonth'
import type { TesterTrialTier } from '@/lib/tour/trial'
import { FreeMonthPagePicker, type PickablePage } from './FreeMonthPagePicker'

// The tester's free month (founder, 2026-10-10): one month free on any paid
// tier, used now or held until the tier they want opens. Nothing pushes the
// tester onto Starter; a tier that isn't open yet says so and waits.
//
// An owner who got their link before they had a page (2026-10-11) sees it
// wait until a page of theirs is live, then picks the page if they own more
// than one.

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
          page first. It doesn’t expire, and you don’t need a card to start.
        </p>
        <FreeMonthPagePicker pages={pages} />
      </>
    )
  }

  const forListing =
    state.listingName && state.listingId !== primaryListingId ? ` for ${state.listingName}` : ''

  if (state.status === 'saved') {
    return (
      <p className="mt-1 max-w-xl font-body text-sm text-charcoal-soft">
        {`Thanks for testing. You have one month free${forListing}. Your listing already has a paid plan, so we’re saving it for an upgrade. It will be ready when Growth and Premium open.`}
      </p>
    )
  }

  const tiers = freeMonthTiers(state.currentTier)
  // Only set for an owner whose enrollment has no page yet: the claim names it.
  const attachTo = state.attach ? state.listingId : undefined

  return (
    <>
      <p className="mt-1 max-w-xl font-body text-sm text-charcoal-soft">
        {`Thanks for testing. You get one month free${forListing} on any plan. Use it now, or save it until the plan you want opens. It doesn’t expire, and you don’t need a card to start.`}
      </p>
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
