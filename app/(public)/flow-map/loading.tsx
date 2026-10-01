import { PageLoader } from '@/components/brand/PageLoader'

// Safe here: nothing under this segment calls notFound() or redirect(). Don't
// add a loading.tsx above a page that can 404, it turns the 404 into a 200.
export default function Loading() {
  return <PageLoader />
}
