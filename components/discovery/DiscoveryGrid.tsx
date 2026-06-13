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
}

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
}: DiscoveryGridProps) {
  if (isLoading) return <LoadingGrid />
  if (error) return <ErrorState message={error} />
  if (entities.length === 0) return <EmptyState query={query} />

  const showing = Math.min(currentPage * entities.length, total)

  return (
    <section aria-label="Discovery results">
      {/* Result count */}
      <p className="font-subhead text-sm text-charcoal mb-4">
        {total === 1
          ? '1 result'
          : `Showing ${showing.toLocaleString()} of ${total.toLocaleString()} results`}
      </p>

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
