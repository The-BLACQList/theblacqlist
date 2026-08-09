import type { DiscoveryEntity } from '@/types'
import { EntityCard } from '@/components/entities/EntityCard'
import { CardCarousel } from '@/components/home/CardCarousel'

interface Props {
  entities: DiscoveryEntity[]
}

/**
 * The newest listings in the index, ungated.
 *
 * Replaces the old most-saved "Trending near you" row [Decision — 2026-08-09].
 * Ordering by `save_count` on a 257-listing index surfaced the same handful
 * every render, because engagement data is thin this early — so the section
 * rewarded tenure and told a business that joined today it was invisible.
 * Recency inverts that: the newest listing leads until a newer one lands.
 *
 * **No tier or `is_featured` clause reaches this query.** That is the founder's
 * "no matter their listing level," and it is the deliberate difference from
 * `MicrositeShowcase`, which does gate on `is_featured`. A free listing and a
 * premium one are ordered by the same clock here.
 *
 * The query's ordering matches how the product already defines "newest"
 * everywhere else — `published_at DESC NULLS LAST` is the `newest` sort key in
 * `search_listings_faceted` — rather than inventing a second definition.
 */
export function FreshFinds({ entities }: Props) {
  // A two-card carousel reads as a broken row rather than a short one.
  if (entities.length < 3) return null

  return (
    <section aria-labelledby="fresh-finds-heading" className="bg-white py-12 md:py-16">
      <div className="max-w-7xl mx-auto w-full px-5 md:px-8 lg:px-10">
        <p className="font-subhead text-xs font-bold uppercase tracking-[0.12em] text-amber mb-1.5">
          Fresh Finds
        </p>
        <h2
          id="fresh-finds-heading"
          className="font-headline text-[26px] md:text-[32px] text-brand-black"
        >
          Just added to the index
        </h2>

        <div className="mt-6">
          <CardCarousel ariaLabel="Recently added listings, horizontally scrollable">
            {entities.slice(0, 15).map((entity) => (
              <EntityCard key={entity.id} entity={entity} />
            ))}
          </CardCarousel>
        </div>
      </div>
    </section>
  )
}
