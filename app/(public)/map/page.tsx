import type { Metadata } from 'next'
import { MapPageClient } from '@/app/(public)/map/MapPageClient'

export const metadata: Metadata = {
  title: 'Explore the Map | The BLACQList',
  description:
    'Every Black-owned business on The BLACQList, pinned on a live map — search, filter, and traverse your neighborhood.',
}

/**
 * The map explore page (MP-A "Full-Bleed Explorer" — Living Commerce Index).
 * Tile URL is env-driven: self-hosted PMTiles in our own storage bucket.
 * Without a configured tile URL the page still works — the drawer's list
 * degrades to the primary surface (map canvas shows the plain ground).
 */
export default function MapPage() {
  const tilesUrl = process.env.NEXT_PUBLIC_MAP_TILES_URL ?? ''
  return <MapPageClient tilesUrl={tilesUrl} />
}
