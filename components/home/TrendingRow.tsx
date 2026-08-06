import type { DiscoveryEntity } from '@/types'
import { EntityCard } from '@/components/entities/EntityCard'

interface Props {
  entities: DiscoveryEntity[]
}

/** Most-saved listings this period — real save_count ordering, no curation. */
export function TrendingRow({ entities }: Props) {
  if (entities.length < 3) return null

  return (
    <section aria-labelledby="trending-heading" className="bg-white py-12 md:py-16">
      <div className="max-w-7xl mx-auto w-full px-5 md:px-8 lg:px-10">
        <p className="font-subhead text-xs font-bold uppercase tracking-[0.12em] text-amber mb-1.5">
          Trending near you
        </p>
        <h2 id="trending-heading" className="font-headline text-[26px] md:text-[32px] text-brand-black">
          Most-saved on The BLACQList
        </h2>

        {/* Desktop grid */}
        <div className="hidden md:grid md:grid-cols-4 gap-4 mt-6">
          {entities.slice(0, 4).map((entity) => (
            <EntityCard key={entity.id} entity={entity} />
          ))}
        </div>

        {/* Mobile snap scroll */}
        <div className="md:hidden flex gap-4 overflow-x-auto pb-4 -mx-5 px-5 snap-x snap-mandatory mt-6">
          {entities.slice(0, 6).map((entity) => (
            <div key={entity.id} className="w-[280px] shrink-0 snap-start">
              <EntityCard entity={entity} />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
