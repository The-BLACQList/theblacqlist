import { EntityCard } from '@/components/entities/EntityCard'
import type { EntityPageData } from '@/types'

interface Props {
  entity: EntityPageData
}

export function EntityRelatedDiscovery({ entity }: Props) {
  const { related } = entity

  // Hidden if fewer than 3 related entities — spec rule
  if (!related || related.length < 3) return null

  return (
    <section aria-labelledby="related-heading" className="bg-pale-lavender py-12 md:py-16">
      <div className="max-w-7xl mx-auto w-full px-4 md:px-6 lg:px-8">
        <h2
          id="related-heading"
          className="font-headline text-[22px] md:text-[28px] text-brand-black mb-8"
        >
          You Might Also Like
        </h2>

        {/* Desktop: 3-col grid | Mobile: horizontal scroll */}
        <div className="hidden md:grid md:grid-cols-3 gap-6">
          {related.map((e) => (
            <EntityCard key={e.id} entity={e} />
          ))}
        </div>

        <div
          className="md:hidden flex gap-4 overflow-x-auto pb-4 -mx-4 px-4 snap-x snap-mandatory"
          role="list"
          aria-label="Related businesses"
        >
          {related.map((e) => (
            <div key={e.id} role="listitem" className="flex-shrink-0 w-[280px] snap-start">
              <EntityCard entity={e} />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
