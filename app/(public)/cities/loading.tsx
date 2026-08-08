import { Container } from '@/components/layout/container'
import { Skeleton } from '@/components/ui/skeleton'

/**
 * Mirrors the shape of the loaded page: hero band, then the bento grid with the
 * feature tile spanning 2×2. Six placeholder tiles is the common case — enough
 * to fill the fold without implying a specific city count.
 */
export default function CitiesLoading() {
  return (
    <main className="min-h-screen bg-pale-lavender">
      <section className="border-b border-charcoal/10">
        <Container className="py-14 md:py-20">
          <Skeleton className="h-3 w-28 mb-4" />
          <Skeleton className="h-10 w-full max-w-lg mb-3" />
          <Skeleton className="h-4 w-full max-w-xl mb-2" />
          <Skeleton className="h-4 w-3/4 max-w-md" />
          <Skeleton className="h-4 w-52 mt-6" />
        </Container>
      </section>

      <section className="bg-off-white py-10 md:py-14">
        <Container>
          <div
            className="grid grid-cols-2 md:grid-cols-3 auto-rows-[132px] md:auto-rows-[156px] gap-3"
            aria-hidden="true"
          >
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton
                key={i}
                className={`rounded-xl h-full w-full ${i === 0 ? 'col-span-2 row-span-2' : ''}`}
              />
            ))}
          </div>
          <span className="sr-only" role="status">
            Loading city chapters
          </span>
        </Container>
      </section>
    </main>
  )
}
