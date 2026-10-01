import { PageLoader } from '@/components/brand/PageLoader'

// Index only, on purpose. A loading boundary makes the route stream, and a
// streamed response has already sent 200, so a notFound() or redirect() in a
// [slug] page under it would become a soft 404. The (index) group keeps the
// slug pages outside this boundary.
export default function Loading() {
  return <PageLoader />
}
