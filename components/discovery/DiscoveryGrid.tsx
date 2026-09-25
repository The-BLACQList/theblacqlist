import Link from 'next/link'
import { CardGrid } from '@/components/ui/card-grid'
import { Skeleton } from '@/components/ui/skeleton'
import { EntityCard } from '@/components/entities/EntityCard'
import type { DiscoveryEntity } from '@/types'

interface DiscoveryGridProps {
  entities: DiscoveryEntity[]
  total: number
  query?: string
  isLoading?: boolean
  error?: string | null
  nextPageUrl?: string
  currentPage?: number
  /** Miles, when a Near You search is active. Drives its own empty state. */
  radiusMiles?: number | null
  /** True when the radius search could not run at all (see lib/listings/query.ts). */
  radiusUnavailable?: boolean
  /** True when a price / attribute / open-now filter could not run at all. */
  filtersUnavailable?: boolean
  /** Same search at a wider radius. Omitted when already at the widest. */
  widerRadiusUrl?: string
  /** Same search with the location filter dropped. */
  clearLocationUrl?: string
  /** The page with every filter dropped. The way out of filtersUnavailable. */
  clearFiltersUrl?: string
}

const linkClass =
  'font-subhead text-sm text-amber hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber rounded-sm'

function LoadingGrid() {
  return (
    <CardGrid cols={{ base: 1, sm: 2, lg: 3, xl: 4 }} gap="md">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="bg-white rounded-xl border border-charcoal/10 overflow-hidden"
          aria-hidden="true"
        >
          <Skeleton className="w-full aspect-video" />
          <div className="p-4 flex flex-col gap-3">
            <div className="flex gap-2">
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <Skeleton className="h-5 w-4/5" />
            <Skeleton className="h-3 w-2/3" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-10 w-full rounded-full" />
          </div>
        </div>
      ))}
    </CardGrid>
  )
}

function EmptyState({ query }: { query?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center px-4">
      <p className="font-headline text-xl text-brand-black mb-2">
        {query ? `No results for "${query}"` : 'No businesses found'}
      </p>
      <p className="font-subhead text-sm text-charcoal max-w-sm">
        {query
          ? 'Try a different search term, or clear some filters to see more results.'
          : 'Try adjusting your filters or browse all categories.'}
      </p>
    </div>
  )
}

/**
 * Zero results inside a radius is not the same emptiness as zero results from a
 * filter, and it has a cause the visitor cannot see: not every published listing
 * has coordinates, and an unmapped business is excluded from every distance
 * search by design. Saying so is the difference between "there is nothing near
 * you" and the truth, which is "there is nothing near you that we have mapped".
 */
function RadiusEmptyState({
  radiusMiles,
  widerRadiusUrl,
  clearLocationUrl,
}: {
  radiusMiles: number
  widerRadiusUrl?: string
  clearLocationUrl?: string
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center px-4">
      <p className="font-headline text-xl text-brand-black mb-2">
        Nothing within {radiusMiles} {radiusMiles === 1 ? 'mile' : 'miles'} of you
      </p>
      <p className="font-subhead text-sm text-charcoal max-w-md">
        Try a wider search, or browse the full directory. Some businesses have not
        been mapped yet, and those never show up in a distance search.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mt-4">
        {widerRadiusUrl && (
          <Link scroll={false} href={widerRadiusUrl} className={linkClass}>
            Search a wider area
          </Link>
        )}
        {clearLocationUrl && (
          <Link scroll={false} href={clearLocationUrl} className={linkClass}>
            Browse every business
          </Link>
        )}
      </div>
    </div>
  )
}

/**
 * The radius search itself could not run. Distinct from "nothing nearby" on
 * purpose: the fallback query cannot express a distance filter, so answering
 * with the whole directory under a Near You heading would be a wrong answer
 * wearing the right label.
 */
function RadiusUnavailableState({ clearLocationUrl }: { clearLocationUrl?: string }) {
  return (
    <div role="alert" className="flex flex-col items-center justify-center py-20 text-center px-4">
      <p className="font-headline text-xl text-brand-black mb-2">
        Distance search is unavailable right now
      </p>
      <p className="font-subhead text-sm text-charcoal max-w-md">
        We could not search by distance just now, so we are not going to guess.
        Try again in a moment, or browse without the location filter.
      </p>
      {clearLocationUrl && (
        <Link scroll={false} href={clearLocationUrl} className={`${linkClass} mt-4`}>
          Browse every business
        </Link>
      )}
    </div>
  )
}

/**
 * A price, amenity or open-now filter could not run. Same reasoning as
 * RadiusUnavailableState one axis over: the fallback query honors only the
 * scalar filters, so answering it would return a wider set than the chips the
 * visitor is looking at claim. Better to say the filter is down than to quietly
 * answer a different question.
 */
function FiltersUnavailableState({ clearFiltersUrl }: { clearFiltersUrl?: string }) {
  return (
    <div role="alert" className="flex flex-col items-center justify-center py-20 text-center px-4">
      <p className="font-headline text-xl text-brand-black mb-2">
        These filters are unavailable right now
      </p>
      <p className="font-subhead text-sm text-charcoal max-w-md">
        We could not apply the price, amenity, or hours filters just now, and we
        are not going to show you results that ignore them. Try again in a
        moment, or browse without those filters.
      </p>
      {clearFiltersUrl && (
        <Link scroll={false} href={clearFiltersUrl} className={`${linkClass} mt-4`}>
          Browse every business
        </Link>
      )}
    </div>
  )
}

function ErrorState({ message }: { message: string }) {
  return (
    <div role="alert" className="flex flex-col items-center justify-center py-20 text-center px-4">
      <p className="font-headline text-xl text-brand-black mb-2">Something went wrong</p>
      <p className="font-subhead text-sm text-charcoal max-w-sm">{message}</p>
    </div>
  )
}

export function DiscoveryGrid({
  entities,
  total,
  query,
  isLoading = false,
  error = null,
  nextPageUrl,
  currentPage = 1,
  radiusMiles = null,
  radiusUnavailable = false,
  filtersUnavailable = false,
  widerRadiusUrl,
  clearLocationUrl,
  clearFiltersUrl,
}: DiscoveryGridProps) {
  if (isLoading) return <LoadingGrid />
  if (error) return <ErrorState message={error} />
  // Both unavailable states come before the empty check on purpose: they also
  // arrive with zero entities, and the empty state would read as an answer.
  if (radiusUnavailable) return <RadiusUnavailableState clearLocationUrl={clearLocationUrl} />
  if (filtersUnavailable) return <FiltersUnavailableState clearFiltersUrl={clearFiltersUrl} />
  if (entities.length === 0)
    return radiusMiles ? (
      <RadiusEmptyState
        radiusMiles={radiusMiles}
        widerRadiusUrl={widerRadiusUrl}
        clearLocationUrl={clearLocationUrl}
      />
    ) : (
      <EmptyState query={query} />
    )

  const showing = Math.min(currentPage * entities.length, total)

  return (
    <section aria-label="Discovery results">
      {/* Result count + the single site-wide ranking disclosure.
          Persistent by design: one link, no per-card badge. The "Sponsored"
          chip on EntityCard stays reserved for the manual placement engine,
          where it means something materially different. */}
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 mb-4">
        <p className="font-subhead text-sm text-charcoal">
          {total === 1
            ? '1 result'
            : `Showing ${showing.toLocaleString()} of ${total.toLocaleString()} results`}
        </p>
        <Link
          href="/how-ranking-works"
          className="font-subhead text-sm text-amber hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber rounded-sm"
        >
          How ranking works
        </Link>
      </div>

      <CardGrid cols={{ base: 1, sm: 2, lg: 3, xl: 4 }} gap="md">
        {entities.map((entity, i) => (
          <EntityCard key={entity.id} entity={entity} isPriority={i === 0} />
        ))}
      </CardGrid>

      {nextPageUrl && (
        <div className="flex justify-center mt-10">
          <Link
            href={nextPageUrl}
            className="font-body font-bold text-sm text-brand-black border border-charcoal/30 rounded-full px-8 py-2.5 min-h-[44px] inline-flex items-center hover:bg-pale-lavender transition-colors"
          >
            Load more
          </Link>
        </div>
      )}
    </section>
  )
}
