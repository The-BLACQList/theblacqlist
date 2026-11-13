'use client'

import { useState } from 'react'
import { Tag } from 'lucide-react'
import { TemplateSectionHeading } from '@/components/entity-page/templates/TemplateSectionHeading'
import type { CouponItem } from '@/types'

interface Props {
  coupons: CouponItem[] | undefined
  bare?: boolean
}

function fmtEnds(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function CouponCard({ coupon }: { coupon: CouponItem }) {
  const [revealed, setRevealed] = useState(false)

  return (
    <li className="relative flex flex-col gap-3 rounded-xl border-2 border-dashed border-gold/70 bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-headline text-[19px] text-brand-black leading-snug">{coupon.title}</p>
          {coupon.description && (
            <p className="font-body text-sm text-charcoal mt-1">{coupon.description}</p>
          )}
        </div>
        <Tag className="size-5 shrink-0 text-amber" aria-hidden="true" />
      </div>

      {/* Reveal is local state only. The intent event (COUPON_REVEALED) lands with
          the live feature in ticket 108 — nothing fires from a sample page. */}
      {coupon.code ? (
        revealed ? (
          <p className="font-mono text-base font-bold tracking-[0.18em] text-brand-black bg-cream rounded-lg px-4 py-2.5 text-center select-all">
            {coupon.code}
          </p>
        ) : (
          <button
            type="button"
            onClick={() => setRevealed(true)}
            className="inline-flex items-center justify-center h-11 px-6 rounded-full bg-gold hover:bg-light-gold text-brand-black font-subhead font-bold text-sm transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber"
          >
            Show code
          </button>
        )
      ) : (
        <p className="font-subhead text-sm font-semibold text-brand-black bg-cream rounded-lg px-4 py-2.5 text-center">
          Show this page at checkout
        </p>
      )}

      <p className="font-body text-xs text-charcoal-soft">
        {coupon.endsAt && <>Ends {fmtEnds(coupon.endsAt)}</>}
        {coupon.endsAt && coupon.terms && <span aria-hidden="true"> · </span>}
        {coupon.terms}
      </p>
    </li>
  )
}

/**
 * Deals and coupons (ticket 108; display here, table and editor in Phase 5).
 * Premium only — hidden until a loader provides `coupons`.
 */
export function EntityCouponsSection({ coupons, bare = false }: Props) {
  if (!coupons || coupons.length === 0) return null

  return (
    <section
      aria-labelledby="coupons-heading"
      className={bare ? undefined : 'bg-pale-lavender py-12 md:py-16'}
    >
      <div className={bare ? undefined : 'max-w-7xl mx-auto w-full px-4 md:px-6 lg:px-8'}>
        {bare ? (
          <TemplateSectionHeading
            kicker="Right now"
            heading="Deals & offers"
            headingId="coupons-heading"
          />
        ) : (
          <h2
            id="coupons-heading"
            className="font-headline text-[22px] md:text-[28px] text-brand-black mb-6"
          >
            Deals &amp; offers
          </h2>
        )}
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-4 md:max-w-3xl">
          {coupons.map((coupon) => (
            <CouponCard key={coupon.id} coupon={coupon} />
          ))}
        </ul>
      </div>
    </section>
  )
}
