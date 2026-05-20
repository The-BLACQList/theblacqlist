import Link from 'next/link'
import { StatusBadge } from '@/components/ui/status-badge'
import type { EntityPageData } from '@/types'

const TIER_DESCRIPTIONS: Record<EntityPageData['trust_tier'], string> = {
  unclaimed:
    'This listing has not yet been claimed by its owner. Information may be incomplete or outdated.',
  claimed: 'The owner of this listing has verified their identity and claimed this page.',
  verified: 'This business has been reviewed and verified by The BLACQList team.',
  certified:
    'This business has met all certification standards set by The BLACQList, including documentation review and community standing.',
}

interface Props {
  entity: EntityPageData
}

export function EntityTrustSection({ entity }: Props) {
  const isUnclaimed = entity.trust_tier === 'unclaimed'

  return (
    <section aria-labelledby="trust-heading" className="bg-pale-lavender py-12 md:py-16">
      <div className="max-w-7xl mx-auto w-full px-4 md:px-6 lg:px-8">
        <h2
          id="trust-heading"
          className="font-headline text-[22px] md:text-[28px] text-brand-black mb-8"
        >
          Trust &amp; Verification
        </h2>

        <div className="flex flex-col md:flex-row md:items-start gap-6">
          <div className="flex-shrink-0">
            <StatusBadge tier={entity.trust_tier} size="standard" />
          </div>

          <div className="flex-1">
            <p className="font-body text-base text-charcoal leading-relaxed mb-4">
              {TIER_DESCRIPTIONS[entity.trust_tier]}
            </p>

            {isUnclaimed && (
              <div className="bg-white rounded-xl border border-amber-gold/40 p-4">
                <p className="font-subhead text-sm font-semibold text-brand-black mb-1">
                  Is this your business?
                </p>
                <p className="font-body text-sm text-charcoal mb-3">
                  Claim this listing to update your information, add photos, and respond to
                  community feedback.
                </p>
                <Link
                  href={`/claim/${entity.id}`}
                  className="inline-flex items-center font-subhead text-sm font-semibold text-amber-gold hover:text-light-gold underline underline-offset-2"
                >
                  Claim this listing
                </Link>
              </div>
            )}

            <p className="font-subhead text-xs text-charcoal/60 mt-4">
              <Link
                href="/about/trust"
                className="hover:text-charcoal underline underline-offset-2"
              >
                Learn how The BLACQList verifies businesses
              </Link>
            </p>
          </div>

          {/* Reviews stub */}
          <div className="flex-shrink-0 md:w-48 bg-white rounded-xl border border-charcoal/10 p-4 text-center">
            {entity.avg_rating !== null ? (
              <>
                <p className="font-headline text-3xl text-brand-black">
                  {entity.avg_rating.toFixed(1)}
                </p>
                <p className="font-subhead text-xs text-charcoal mt-0.5">out of 5</p>
                <p className="font-subhead text-xs text-charcoal/60 mt-1">
                  {entity.review_count.toLocaleString()} reviews
                </p>
              </>
            ) : (
              <p className="font-subhead text-sm text-charcoal/60">No reviews yet</p>
            )}
            <p className="font-subhead text-[10px] text-charcoal/40 mt-3 uppercase tracking-wide">
              Reviews coming soon
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
