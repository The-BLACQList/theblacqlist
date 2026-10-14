import type { Metadata } from 'next'
import { MapPageClient } from '@/app/(public)/map/MapPageClient'
import { TourWitness } from '@/components/tour/TourWitness'

export const metadata: Metadata = {
  title: 'Explore the Map | The BLACQList',
  description:
    'Every Black-owned business on The BLACQList, pinned on a live map. Search, filter, and traverse your neighborhood.',
}

/**
 * The map explore page (MP-A "Full-Bleed Explorer" — Living Commerce Index).
 * Basemap tiles come from our own /api/map/tiles route (lib/map/tileUrls.ts).
 * If they fail the page still works: the drawer's list is the primary
 * surface and the canvas shows the plain ground.
 */
export default function MapPage() {
  return (
    <>
      {/* Tester Tour: opening the map is the whole step. Renders nothing and
          never throws (components/tour/TourWitness.tsx). */}
      <TourWitness step="map_opened" />
      <MapPageClient />
    </>
  )
}
