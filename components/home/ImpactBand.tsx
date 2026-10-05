import Link from 'next/link'

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
 * tracking a receipt (joining) and links out to The Collective map. With no
 * tracked spend yet, it invites the first receipt instead of showing zeros.
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
      className="relative bg-deep-bg py-14 md:py-16 overflow-hidden"
    >
      <span
        className="absolute inset-0 opacity-[0.18]"
        aria-hidden="true"
        style={{
          backgroundImage: [
            'radial-gradient(circle at 14% 32%, var(--color-gold) 1.6px, transparent 2.6px)',
            'radial-gradient(circle at 68% 58%, var(--color-gold) 1.6px, transparent 2.6px)',
            'radial-gradient(circle at 42% 84%, var(--color-gold) 1.6px, transparent 2.6px)',
            'radial-gradient(circle at 88% 20%, var(--color-gold) 1.6px, transparent 2.6px)',
          ].join(', '),
          backgroundSize: '320px 320px',
        }}
      />

      <div className="relative max-w-7xl mx-auto w-full px-5 md:px-8 lg:px-10 grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
        <div>
          <p className="font-subhead text-xs font-bold uppercase tracking-[0.12em] text-gold mb-1.5">
            The Collective
          </p>
          <h2 id="impact-heading" className="font-headline text-[26px] md:text-[32px] text-white max-w-[20ch] text-balance">
            Join The Collective.
          </h2>
          <p className="font-body text-[15px] text-off-white/80 mt-3 max-w-[52ch]">
            Track a receipt and your spend joins everyone else&apos;s on one live map. Together it
            shows where our money goes.
          </p>
          <div className="flex gap-3 flex-wrap mt-6">
            <Link
              href="/account/receipts/new"
              className="inline-flex items-center justify-center h-11 px-6 rounded-full bg-gold hover:bg-light-gold text-brand-black font-subhead text-sm font-bold transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
            >
              Track a receipt
            </Link>
            <Link
              href="/flow-map"
              className="inline-flex items-center justify-center h-11 px-6 rounded-full border border-off-white/40 bg-off-white/10 hover:bg-off-white/20 text-white font-subhead text-sm font-bold transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
            >
              See The Collective
            </Link>
          </div>
        </div>

        <dl className="grid grid-cols-3 gap-4 m-0">
          {hasData ? (
            <>
              <div className="border-t-2 border-gold pt-3">
                <dd className="font-headline text-[28px] md:text-[34px] text-white m-0">
                  {formatDollars(totalAmountCents)}
                </dd>
                <dt className="font-subhead text-xs text-off-white/70">spent</dt>
              </div>
              <div className="border-t-2 border-gold pt-3">
                <dd className="font-headline text-[28px] md:text-[34px] text-white m-0">
                  {totalTransactions.toLocaleString()}
                </dd>
                <dt className="font-subhead text-xs text-off-white/70">tracked purchases</dt>
              </div>
              <div className="border-t-2 border-gold pt-3">
                <dd className="font-headline text-[28px] md:text-[34px] text-white m-0">
                  {uniqueBusinesses.toLocaleString()}
                </dd>
                <dt className="font-subhead text-xs text-off-white/70">businesses supported</dt>
              </div>
            </>
          ) : (
            <div className="col-span-3 border-t-2 border-gold pt-3">
              <dd className="font-headline text-[20px] text-white m-0">
                The Collective is waiting on its first dollar.
              </dd>
              <dt className="font-subhead text-xs text-off-white/70 mt-1">
                Track a receipt and be the first in.
              </dt>
            </div>
          )}
        </dl>
      </div>
    </section>
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
