import Link from 'next/link'
import { ChevronRight, Lock } from 'lucide-react'
import { formatCount, sparkPoints } from '@/lib/dashboard/home'
import type { HomeSnapshot } from '@/lib/dashboard/homeData'

function Spark({ values }: { values: number[] }) {
  const points = sparkPoints(values)
  if (!points) {
    return <p className="mt-3 font-body text-sm text-charcoal-soft">No Daily Trend Yet</p>
  }
  return (
    <svg
      viewBox="0 0 100 32"
      preserveAspectRatio="none"
      aria-hidden="true"
      className="mt-3 h-8 w-full text-amber"
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

function Tile({ label, value, values }: { label: string; value: number; values: number[] }) {
  return (
    <div className="min-w-0 rounded-xl border border-charcoal/10 bg-white px-3 py-3 sm:px-4 sm:py-4">
      <p className="font-subhead text-sm text-charcoal-soft">{label}</p>
      <p className="mt-1 font-headline text-2xl text-brand-black sm:text-3xl">
        {formatCount(value)}
      </p>
      <Spark values={values} />
    </div>
  )
}

function SectionHead({ insightsHref }: { insightsHref: string }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <h2 id="snapshot-heading" className="font-headline text-lg text-brand-black">
        Last 30 Days
      </h2>
      <Link
        href={insightsHref}
        className="inline-flex min-h-[44px] items-center gap-1 font-subhead text-sm font-semibold text-amber hover:underline"
      >
        Open Insights <ChevronRight className="size-4" aria-hidden="true" />
      </Link>
    </div>
  )
}

// The page's last 30 days at a glance (ticket 253): the same totals as
// Insights, with a small daily line under each.
export function Snapshot({
  snapshot,
  insightsHref,
}: {
  snapshot: HomeSnapshot
  insightsHref: string
}) {
  return (
    <section aria-labelledby="snapshot-heading" data-testid="home-snapshot">
      <SectionHead insightsHref={insightsHref} />
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <Tile label="Views" value={snapshot.views} values={snapshot.series.views} />
        <Tile label="Taps" value={snapshot.taps} values={snapshot.series.taps} />
        <Tile label="Saves" value={snapshot.saves} values={snapshot.series.saves} />
      </div>
      <p className="mt-2 font-body text-sm text-charcoal-soft">
        Taps are calls, website visits, directions and storefront clicks.
      </p>
    </section>
  )
}

const SAMPLE_BARS = [30, 45, 38, 60, 52, 70, 64, 80, 72, 90]

// Free pages (ticket 253): the shape of the snapshot with no numbers in it.
// Nothing is read for a Free page, so no real figure can leak.
export function LockedSnapshot() {
  return (
    <section
      aria-labelledby="snapshot-locked-heading"
      data-testid="home-snapshot-locked"
      className="overflow-hidden rounded-2xl border border-charcoal/10 bg-white"
    >
      <div className="grid gap-5 px-5 py-5 sm:grid-cols-[1fr_auto] sm:items-center">
        <div>
          <p className="inline-flex items-center gap-1.5 font-subhead text-sm text-charcoal-soft">
            <Lock className="size-4" aria-hidden="true" /> Starter and Up
          </p>
          <h2 id="snapshot-locked-heading" className="mt-1 font-headline text-lg text-brand-black">
            See Who Finds Your Page
          </h2>
          <p className="mt-1 max-w-md font-body text-sm text-charcoal-soft">
            Views, taps and saves for your last 30 days, with a daily trend, right here on Home.
          </p>
          <Link
            href="/dashboard/upgrade"
            className="mt-4 inline-flex min-h-[44px] items-center justify-center rounded-full bg-amber-gold px-5 font-subhead text-sm font-semibold text-brand-black transition-colors hover:bg-light-gold"
          >
            See Plans
          </Link>
        </div>
        <div aria-hidden="true" className="flex h-24 items-end gap-1.5 sm:w-56">
          {SAMPLE_BARS.map((h, i) => (
            <span key={i} className="flex-1 rounded-t bg-charcoal/10" style={{ height: `${h}%` }} />
          ))}
        </div>
      </div>
    </section>
  )
}
