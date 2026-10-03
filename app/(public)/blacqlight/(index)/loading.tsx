import { Container } from '@/components/layout/container'
import { Skeleton } from '@/components/ui/skeleton'

// Index only, on purpose. A loading boundary makes the route stream, and a
// streamed response has already sent 200, so a notFound() or redirect() in a
// [slug] page under it would become a soft 404. The (index) group keeps the
// slug pages outside this boundary.
//
// Shaped like the page (ticket 116): header, a lead block, then three cards.
export default function Loading() {
  return (
    <main className="min-h-screen bg-off-white" aria-busy="true" aria-label="Loading stories">
      <section className="bg-deep-bg">
        <Container className="pt-14 md:pt-20 pb-16 md:pb-24 flex flex-col gap-4">
          <Skeleton className="h-3 w-40 bg-off-white/10" />
          <Skeleton className="h-[clamp(48px,9vw,112px)] w-3/4 max-w-[640px] bg-off-white/10" />
          <Skeleton className="h-5 w-full max-w-[56ch] bg-off-white/10" />
          <div className="mt-10 grid gap-8 border-t border-off-white/20 pt-10 lg:grid-cols-2 lg:items-center">
            <Skeleton className="aspect-[4/3] w-full rounded-[3px] bg-off-white/10" />
            <div className="flex flex-col gap-4">
              <Skeleton className="h-3 w-28 bg-off-white/10" />
              <Skeleton className="h-12 w-full bg-off-white/10" />
              <Skeleton className="h-12 w-2/3 bg-off-white/10" />
              <Skeleton className="h-4 w-40 bg-off-white/10" />
              <Skeleton className="h-12 w-40 rounded-full bg-off-white/10" />
            </div>
          </div>
        </Container>
      </section>
      <section>
        <Container className="py-16 md:py-20 flex flex-col gap-8">
          <Skeleton className="h-10 w-56 bg-charcoal/10" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="flex flex-col gap-3 rounded-xl border border-charcoal/10 bg-white p-5"
              >
                <Skeleton className="h-3 w-24 bg-charcoal/10" />
                <Skeleton className="h-7 w-full bg-charcoal/10" />
                <Skeleton className="h-4 w-3/4 bg-charcoal/10" />
                <Skeleton className="h-3 w-32 bg-charcoal/10" />
              </div>
            ))}
          </div>
        </Container>
      </section>
    </main>
  )
}
