import Link from 'next/link'

import {
  EGO_MAX_NODES_NARROW,
  EGO_MAX_NODES_WIDE,
  EGO_RING_NARROW,
  EGO_RING_WIDE,
  egoNodeLabel,
  layoutEgoRing,
  type EgoRing,
  type EgoSpendSummary,
} from '@/lib/account/egoNetwork'
import { formatDollars } from '@/lib/spend/personal-spend'

/**
 * "Your place in The Collective" on /account (ticket 114).
 *
 * PRIVATE: this shows one person's own spend, business by business. It must
 * never render on a public page; public views stay behind the 5-person cohort
 * rule in lib/spend/aggregate-privacy.ts.
 */

export interface CollectiveBusiness {
  listingId: string
  name: string
  category: string | null
  /** Listing page, or null when the listing is no longer public. */
  href: string | null
  amountCents: number
}

interface Props {
  summary: EgoSpendSummary
  /** Top businesses in spend order, at most EGO_MAX_NODES_WIDE. */
  businesses: CollectiveBusiness[]
}

const buttonBase =
  'inline-flex w-full sm:w-auto items-center justify-center min-h-[46px] px-[22px] rounded-[3px] font-subhead text-[15px] font-semibold transition-colors duration-150'

export function CollectivePanel({ summary, businesses }: Props) {
  const isEmpty = summary.approvedReceiptCount === 0
  const businessCount = summary.businesses.length

  return (
    <section aria-labelledby="collective-heading" className="flex flex-wrap items-center gap-10">
      <div className="flex flex-col gap-3.5 flex-[1_1_340px] min-w-0">
        <p className="font-subhead text-xs font-bold uppercase tracking-[0.14em] text-amber">
          Your place in The Collective
        </p>

        {isEmpty ? (
          <>
            <h2
              id="collective-heading"
              className="font-headline font-medium text-[26px] md:text-[32px] leading-[1.15] text-ink text-balance"
            >
              You&apos;re not in The Collective yet.
            </h2>
            <p className="font-body text-base leading-relaxed text-charcoal max-w-[52ch]">
              Track a receipt from a business on the list. Once it&apos;s approved, your spend
              shows up here and joins everyone else&apos;s on the map.
            </p>
          </>
        ) : (
          <>
            <h2
              id="collective-heading"
              className="font-headline font-medium text-[26px] md:text-[32px] leading-[1.15] text-ink text-balance"
            >
              You&apos;ve spent {formatDollars(summary.totalCents)} with {businessCount}{' '}
              {businessCount === 1 ? 'business' : 'businesses'} on the list.
            </h2>
            {summary.unmatchedCents > 0 && (
              <p className="font-subhead text-sm text-charcoal">
                {formatDollars(summary.unmatchedCents)} at places not on the list yet
              </p>
            )}
            <p className="font-body text-base leading-relaxed text-charcoal max-w-[52ch]">
              Each approved receipt adds your spend to The Collective. Only you see this view. On
              the public map, members show up together, never one by one.
            </p>
          </>
        )}

        {summary.pendingReceiptCount > 0 && (
          <p className="font-subhead text-sm font-semibold text-amber">
            {summary.pendingReceiptCount}{' '}
            {summary.pendingReceiptCount === 1 ? 'receipt' : 'receipts'} waiting for review.
          </p>
        )}

        <div className="flex flex-col sm:flex-row flex-wrap gap-3 pt-1.5">
          {isEmpty ? (
            <Link
              href="/account/receipts/new"
              className={`${buttonBase} bg-ink text-off-white hover:bg-brand-black`}
            >
              Track a receipt
            </Link>
          ) : (
            <>
              <Link
                href="/flow-map"
                className={`${buttonBase} bg-ink text-off-white hover:bg-brand-black`}
              >
                Open The Collective
              </Link>
              <Link
                href="/account/receipts/new"
                className={`${buttonBase} border border-ink text-ink hover:bg-ink/5`}
              >
                Track a receipt
              </Link>
            </>
          )}
        </div>
      </div>

      <figure className="m-0 flex-[1_1_360px] min-w-0">
        <div className="sm:hidden">
          <EgoSvg ring={EGO_RING_NARROW} businesses={businesses.slice(0, EGO_MAX_NODES_NARROW)} />
        </div>
        <div className="hidden sm:block">
          <EgoSvg ring={EGO_RING_WIDE} businesses={businesses.slice(0, EGO_MAX_NODES_WIDE)} />
        </div>

        {!isEmpty && (
          <figcaption>
            {/* The screen-reader and keyboard version of the ring. Each link
                appears on screen when it takes focus. */}
            <ul className="list-none m-0 p-0">
              {businesses.map((b) => {
                const text = `${b.name}${b.category ? `, ${b.category}` : ''}, ${formatDollars(b.amountCents)}`
                return (
                  <li key={b.listingId}>
                    {b.href ? (
                      <Link
                        href={b.href}
                        className="sr-only focus:not-sr-only focus:inline-flex focus:min-h-[44px] focus:items-center font-subhead text-sm text-amber underline underline-offset-2"
                      >
                        {text}
                      </Link>
                    ) : (
                      <span className="sr-only">{text}</span>
                    )}
                  </li>
                )
              })}
            </ul>
            <MoreLinks total={businessCount} />
          </figcaption>
        )}
      </figure>
    </section>
  )
}

/**
 * Stands in for the panel while The Collective is covered (ticket 122). Points
 * at the cover page, which carries the waitlist.
 */
export function CollectiveSoonPanel() {
  return (
    <section aria-labelledby="collective-heading" className="flex flex-col gap-3.5">
      <p className="font-subhead text-xs font-bold uppercase tracking-[0.14em] text-amber">
        The Collective &middot; Opening soon
      </p>
      <h2
        id="collective-heading"
        className="font-headline font-medium text-[26px] md:text-[32px] leading-[1.15] text-ink text-balance"
      >
        The Collective isn&apos;t open yet.
      </h2>
      <p className="font-body text-base leading-relaxed text-charcoal max-w-[52ch]">
        Soon you&apos;ll be able to track what you spend with businesses on the list and see it add
        up with everyone else&apos;s. We&apos;re still building it.
      </p>
      <div className="pt-1.5">
        <Link href="/flow-map" className={`${buttonBase} border border-ink text-ink hover:bg-ink/5`}>
          Tell me when it opens
        </Link>
      </div>
    </section>
  )
}

/** "+{k} more" beyond the ring, with the narrow and wide caps. */
function MoreLinks({ total }: { total: number }) {
  const narrowExtra = total - EGO_MAX_NODES_NARROW
  const wideExtra = total - EGO_MAX_NODES_WIDE
  const linkClass =
    'inline-flex min-h-[44px] items-center font-subhead text-sm font-semibold text-amber underline underline-offset-2 hover:text-brand-black'
  return (
    <>
      {narrowExtra > 0 && (
        <Link href="/account/spending" className={`${linkClass} sm:hidden`}>
          +{narrowExtra} more
        </Link>
      )}
      {wideExtra > 0 && (
        <Link href="/account/spending" className={`${linkClass} hidden sm:inline-flex`}>
          +{wideExtra} more
        </Link>
      )}
    </>
  )
}

function EgoSvg({ ring, businesses }: { ring: EgoRing; businesses: CollectiveBusiness[] }) {
  const nodes = layoutEgoRing(businesses.length, ring)
  const placed = businesses.flatMap((b, i) => {
    const n = nodes[i]
    return n ? [{ b, n }] : []
  })
  return (
    <svg
      viewBox={`0 0 ${ring.width} ${ring.height}`}
      width="100%"
      aria-hidden="true"
      focusable="false"
      className="block"
    >
      <g stroke="#b9a37a" strokeWidth={1}>
        {placed.map(({ b, n }) => (
          <line key={b.listingId} x1={ring.cx} y1={ring.cy} x2={n.x} y2={n.y} />
        ))}
      </g>
      {placed.map(({ b, n }) => {
        const label = egoNodeLabel(b.category ?? b.name, formatDollars(b.amountCents))
        const content = (
          <>
            <circle cx={n.x} cy={n.y} r={6} fill="#1d1c1d" />
            <text
              x={n.labelX}
              y={n.labelY}
              textAnchor={n.anchor}
              fontFamily="var(--font-body), sans-serif"
              fontSize={13}
              fill="#1d1c1d"
            >
              {label}
            </text>
          </>
        )
        // Mouse users can click a node; keyboard and screen-reader users get
        // the same links from the list in the figcaption.
        return b.href ? (
          <a key={b.listingId} href={b.href} tabIndex={-1} className="hover:opacity-70">
            {content}
          </a>
        ) : (
          <g key={b.listingId}>{content}</g>
        )
      })}
      <circle cx={ring.cx} cy={ring.cy} r={20} fill="none" stroke="#c4a065" strokeWidth={1} />
      <circle cx={ring.cx} cy={ring.cy} r={9} fill="#c4a065" />
      <text
        x={ring.cx}
        y={ring.cy + 42}
        textAnchor="middle"
        fontFamily="var(--font-body), sans-serif"
        fontSize={13}
        fontWeight={600}
        fill="#1d1c1d"
      >
        You
      </text>
    </svg>
  )
}
