'use client'

import dynamic from 'next/dynamic'

// MapLibre + PMTiles stay out of the initial bundle (LCI perf guardrails);
// the loading state holds the layout while the map chunk streams in.
const MapExplore = dynamic(
  () => import('@/components/map/MapExplore').then((m) => m.MapExplore),
  {
    ssr: false,
    loading: () => (
      <div
        className="h-[calc(100dvh_-_3.5rem)] md:h-[calc(100dvh_-_4rem)] bg-pale-lavender flex items-center justify-center"
        role="status"
        aria-label="Loading the map"
      >
        <p className="font-subhead text-sm text-charcoal-soft">Loading the map…</p>
      </div>
    ),
  }
)

export function MapPageClient({ tilesUrl }: { tilesUrl: string }) {
  return <MapExplore tilesUrl={tilesUrl} />
}
