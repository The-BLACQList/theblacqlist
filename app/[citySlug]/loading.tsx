import { PageLoader } from '@/components/brand/PageLoader'

// Listing pages live outside the (public) group, so they need their own boundary.
export default function ListingLoading() {
  return <PageLoader />
}
