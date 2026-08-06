import Link from 'next/link'

interface Props {
  totalAmountCents: number
  totalTransactions: number
  uniqueBusinesses: number
}

function formatDollars(cents: number): string {
  const dollars = cents / 100
  if (dollars >= 1_000_000) return `$${(dollars / 1_000_000).toFixed(1)}M`
  if (dollars >= 1_000) return `$${(dollars / 1_000).toFixed(1)}K`
  return `$${Math.round(dollars).toLocaleString()}`
}

/**
 * Community impact band wired to the LIVE flow-map data (no more
 * "Coming Soon" on a shipped feature). With no tracked spend yet, the
 * band invites the first receipt instead of showing zeros as impact.
 */
export function ImpactBand({ totalAmountCents, totalTransactions, uniqueBusinesses }: Props) {
  const hasData = totalAmountCents > 0

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
            Community impact
          </p>
          <h2 id="impact-heading" className="font-headline text-[26px] md:text-[32px] text-white max-w-[20ch] text-balance">
            Watch the dollars circulate
          </h2>
          <p className="font-body text-[15px] text-off-white/80 mt-3 max-w-[52ch]">
            Every tracked receipt keeps money moving through Black-owned business. The flow map
            shows the network in motion — live.
          </p>
          <div className="flex gap-3 flex-wrap mt-6">
            <Link
              href="/flow-map"
              className="inline-flex items-center justify-center h-11 px-6 rounded-full bg-gold hover:bg-light-gold text-brand-black font-subhead text-sm font-bold transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
            >
              Explore the flow map
            </Link>
            <Link
              href="/account/receipts/new"
              className="inline-flex items-center justify-center h-11 px-6 rounded-full border border-off-white/40 bg-off-white/10 hover:bg-off-white/20 text-white font-subhead text-sm font-bold transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
            >
              Track a receipt
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
                <dt className="font-subhead text-xs text-off-white/70">circulated</dt>
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
                The map is waiting on its first dollar.
              </dd>
              <dt className="font-subhead text-xs text-off-white/70 mt-1">
                Track a receipt and start the flow.
              </dt>
            </div>
          )}
        </dl>
      </div>
    </section>
  )
}
