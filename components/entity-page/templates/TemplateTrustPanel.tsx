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

const OWNERSHIP_TEXT: Record<EntityPageData['ownership_label'], string> = {
  black_owned: 'Black-Owned',
  ally: 'Ally',
}

interface Props {
  entity: EntityPageData
}

/**
 * Compact trust panel for the microsite templates (Living Commerce Index
 * anatomy ⑧): sticky aside on desktop so trust rides alongside the business
 * story without interrupting it.
 */
export function TemplateTrustPanel({ entity }: Props) {
  const isUnclaimed = entity.trust_tier === 'unclaimed'

  return (
    <div className="lg:sticky lg:top-32 bg-pale-lavender border-t-[3px] border-gold rounded-b-xl p-5 md:p-6">
      <h2 className="font-headline text-[19px] text-brand-black mb-3.5">
        Trust on The BLACQList
      </h2>

      <div className="mb-4">
        <StatusBadge tier={entity.trust_tier} size="standard" />
      </div>

      <div className="divide-y divide-charcoal/10 font-body text-[13.5px] text-charcoal">
        <p className="py-2.5">{TIER_DESCRIPTIONS[entity.trust_tier]}</p>
        <p className="py-2.5">
          Ownership label:{' '}
          <strong className="text-brand-black">{OWNERSHIP_TEXT[entity.ownership_label]}</strong>
        </p>
        {entity.review_count > 0 && (
          <p className="py-2.5">
            <strong className="text-brand-black">
              {entity.review_count.toLocaleString()} review{entity.review_count === 1 ? '' : 's'}
            </strong>{' '}
            from the community · moderated for authenticity
          </p>
        )}
        {isUnclaimed && (
          <p className="py-2.5">
            Is this your business?{' '}
            <Link
              href={`/claim/${entity.id}`}
              className="font-subhead font-semibold text-amber hover:text-brand-black underline underline-offset-2 transition-colors duration-150"
            >
              Claim this listing
            </Link>
          </p>
        )}
        <p className="py-2.5 font-subhead text-xs text-charcoal-soft">
          <Link
            href={`/corrections?listing=${entity.id}`}
            className="hover:text-charcoal underline underline-offset-2 transition-colors duration-150"
          >
            Suggest a correction
          </Link>
          {' · '}
          <Link
            href="/about/trust"
            className="hover:text-charcoal underline underline-offset-2 transition-colors duration-150"
          >
            How verification works
          </Link>
        </p>
      </div>
    </div>
  )
}
