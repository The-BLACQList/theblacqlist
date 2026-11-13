import { Tag } from 'lucide-react'
import { DealCodeButton } from '@/components/entity-page/DealCodeButton'
import { dealEndsLabel, type PublicDeal } from '@/lib/listings/deals'

// Coupons and deals (owner-experience round 2, part G). One card per live deal
// the plan allows, soonest ending first (lib/listings/deals.ts). The business
// honours the code itself; nothing here redeems anything.

interface Props {
  listingId: string
  deals: readonly PublicDeal[] | undefined
  now: Date
}

export function EntityDeals({ listingId, deals, now }: Props) {
  if (!deals || deals.length === 0) return null

  return (
    <section
      id="deals"
      aria-labelledby="deals-heading"
      className="scroll-mt-32 bg-white py-12 md:py-16"
    >
      <div className="max-w-7xl mx-auto w-full px-4 md:px-6 lg:px-8">
        <h2
          id="deals-heading"
          className="font-headline text-[22px] md:text-[28px] text-brand-black mb-6"
        >
          Deals
        </h2>
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {deals.map((deal) => {
            const ends = dealEndsLabel(deal.endsAt, now)
            return (
              <li
                key={deal.id}
                className="flex flex-col gap-3 rounded-xl border border-charcoal/10 bg-white p-5"
              >
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-amber-gold/15 text-amber">
                    <Tag className="size-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-subhead text-base font-semibold text-brand-black break-words">
                      {deal.title}
                    </h3>
                    {deal.description && (
                      <p className="mt-1 font-body text-sm text-charcoal break-words">
                        {deal.description}
                      </p>
                    )}
                  </div>
                </div>
                {deal.code && (
                  <DealCodeButton listingId={listingId} dealId={deal.id} code={deal.code} />
                )}
                {(ends || deal.terms) && (
                  <div className="mt-auto space-y-1 font-body text-xs text-charcoal-soft">
                    {ends && <p>{ends}</p>}
                    {deal.terms && <p className="break-words">{deal.terms}</p>}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
