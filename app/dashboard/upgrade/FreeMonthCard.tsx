import { ClaimTrialButton } from '@/components/tour/ClaimTrialButton'
import { isPlanPurchasable, type PlanAvailability } from '@/lib/stripe/availability'
import { getPlanMeta } from '@/lib/stripe/plans'
import { freeMonthTiers, type FreeMonthState } from '@/lib/tour/freeMonth'

// The tester's free month (founder, 2026-10-10): one month free on any paid
// tier, used now or held until the tier they want opens. Nothing pushes the
// tester onto Starter; a tier that isn't open yet says so and waits.

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
            <li key={tier} className="flex flex-col rounded-lg border border-charcoal/10 bg-white p-4">
              <p className="mb-3 font-subhead text-sm font-bold text-brand-black">{name}</p>
              {open ? (
                <ClaimTrialButton
                  plan={tier}
                  label={state.openTier === tier ? 'Resume checkout' : `Use it on ${name}`}
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
