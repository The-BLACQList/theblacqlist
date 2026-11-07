import Link from 'next/link'

import { CollectiveCloseUp } from '@/components/home/CollectiveCloseUp'
import { LaunchWaitlist } from '@/components/marketing/LaunchWaitlist'
import { SOON_FEATURES } from '@/lib/features/opening-soon'

interface Props {
  totalAmountCents: number
  totalTransactions: number
  uniqueBusinesses: number
  /**
   * The Collective isn't open yet (ticket 122). The band keeps its place on the
   * homepage but trades the receipt and map buttons, and the live totals, for a
   * waitlist.
   */
  covered: boolean
}

function formatDollars(cents: number): string {
  const dollars = cents / 100
  if (dollars >= 1_000_000) return `$${(dollars / 1_000_000).toFixed(1)}M`
  if (dollars >= 1_000) return `$${(dollars / 1_000).toFixed(1)}K`
  return `$${Math.round(dollars).toLocaleString()}`
}

/**
 * The Collective band, wired to the LIVE flow-map data. It leads with
 * tracking a receipt (joining) and links out to The Collective map, beside a
 * close-up of the Silo that lights up as receipts come in. With no tracked
 * spend yet, it invites the first receipt instead of showing zeros.
 */
export function ImpactBand({
  totalAmountCents,
  totalTransactions,
  uniqueBusinesses,
  covered,
}: Props) {
  const hasData = totalAmountCents > 0

  if (covered) return <CoveredBand />

  return (
    <section
      aria-labelledby="impact-heading"
      className="relative bg-deep-bg overflow-hidden lg:flex lg:items-center lg:min-h-[520px]"
    >
      <CollectiveCloseUp purchases={totalTransactions} businesses={uniqueBusinesses} />

      <div className="relative z-10 max-w-7xl mx-auto w-full px-5 md:px-8 lg:px-10 pb-10 md:pb-14 lg:py-14">
        <div className="lg:max-w-[440px]">
          <p className="font-subhead text-xs font-bold uppercase tracking-[0.12em] text-gold mb-1.5">
            The Collective
          </p>
          <h2
            id="impact-heading"
            className="font-headline text-[28px] lg:text-[36px] text-white max-w-[20ch] text-balance"
          >
            Join The Collective.
          </h2>
          <p className="font-body text-[15px] text-off-white/80 mt-3 max-w-[44ch]">
            Every receipt puts another dollar on the map. Together we can see where our money goes.
          </p>
          <div className="flex gap-3 flex-wrap mt-6">
            <Link
              href="/account/receipts/new"
              className="inline-flex items-center justify-center h-11 px-6 rounded-full bg-gold hover:bg-light-gold text-brand-black font-subhead text-sm font-bold transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
            >
              Add a receipt
            </Link>
            <Link
              href="/flow-map"
              className="inline-flex items-center justify-center h-11 px-6 rounded-full border border-off-white/40 bg-off-white/10 hover:bg-off-white/20 text-white font-subhead text-sm font-bold transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
            >
              See The Collective
            </Link>
          </div>

          {hasData ? (
            <dl className="flex flex-wrap gap-x-7 gap-y-4 mt-7">
              <Stat label="spent" value={formatDollars(totalAmountCents)} />
              <Stat
                label={totalTransactions === 1 ? 'purchase' : 'purchases'}
                value={totalTransactions.toLocaleString()}
              />
              <Stat
                label={uniqueBusinesses === 1 ? 'business' : 'businesses'}
                value={uniqueBusinesses.toLocaleString()}
              />
            </dl>
          ) : (
            <div className="mt-7">
              <p className="font-headline text-[20px] text-white">Waiting on its first dollar.</p>
              <p className="font-subhead text-xs text-off-white/70 mt-0.5">
                Add a receipt and be the first in.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col-reverse">
      <dt className="font-subhead text-xs text-off-white/70">{label}</dt>
      <dd className="font-headline text-[22px] lg:text-[26px] text-white m-0">{value}</dd>
    </div>
  )
}

const COLLECTIVE = SOON_FEATURES.collective

function CoveredBand() {
  return (
    <section
      aria-labelledby="impact-heading"
      className="relative bg-deep-bg py-14 md:py-16 overflow-hidden"
    >
      <div className="relative max-w-7xl mx-auto w-full px-5 md:px-8 lg:px-10 grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
        <div>
          <p className="font-subhead text-xs font-bold uppercase tracking-[0.12em] text-gold mb-1.5">
            The Collective &middot; Opening soon
          </p>
          <h2
            id="impact-heading"
            className="font-headline text-[26px] md:text-[32px] text-white max-w-[20ch] text-balance"
          >
            See where our money goes.
          </h2>
          <p className="font-body text-[15px] text-off-white/80 mt-3 max-w-[52ch]">
            Soon you&apos;ll be able to track what you spend with businesses on the list and watch
            it add up with everyone else&apos;s. We&apos;re still building it.
          </p>
        </div>

        <div className="rounded-2xl bg-off-white p-5 md:p-6">
          <p className="font-subhead text-sm font-semibold text-brand-black">
            Want to know the day it opens?
          </p>
          <LaunchWaitlist
            options={[{ value: COLLECTIVE.source, label: COLLECTIVE.name }]}
            id="home-collective-waitlist"
            className="mt-3 max-w-none"
            submitLabel="Tell me when it opens"
            successMessage="You're on the list. We'll email you the day The Collective opens."
          />
        </div>
      </div>
    </section>
  )
}
