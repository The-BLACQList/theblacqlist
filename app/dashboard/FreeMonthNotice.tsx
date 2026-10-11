import Link from 'next/link'
import { getFreeMonthState } from '@/lib/tour/freeMonth'
import { waitingCopy } from './upgrade/FreeMonthCard'

// The dashboard home's line about the free month, only for an owner tester
// whose link had no page (2026-10-11). /dashboard/upgrade needs a page to
// open, so while they have none this is the one place that says the month is
// saved. Once a page of theirs is live it points to the card. Owners whose
// link named a page see the card on /dashboard/upgrade as before.
export async function FreeMonthNotice() {
  const state = await getFreeMonthState()
  if (!state) return null

  const ready = state.status === 'pick' || (state.status === 'ready' && state.attach)
  if (state.status !== 'waiting' && !ready) return null

  return (
    <section
      aria-labelledby="free-month-notice-heading"
      className="rounded-xl border border-amber-gold/50 bg-amber-gold/5 p-5"
    >
      <h2 id="free-month-notice-heading" className="font-headline text-lg text-brand-black">
        Your free month
      </h2>
      {state.status === 'waiting' ? (
        <p className="mt-1 max-w-xl font-body text-sm text-charcoal-soft">
          {waitingCopy(state.hasPage)}
        </p>
      ) : (
        <>
          <p className="mt-1 max-w-xl font-body text-sm text-charcoal-soft">
            Your page is live, so your free month is ready to use.
          </p>
          <Link
            href="/dashboard/upgrade#free-month"
            className="mt-3 inline-flex h-11 items-center rounded-full bg-amber-gold px-5 font-body text-sm font-bold text-brand-black transition-colors hover:bg-light-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-gold focus-visible:ring-offset-2"
          >
            Use your free month
          </Link>
        </>
      )}
    </section>
  )
}
