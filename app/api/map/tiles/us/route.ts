import type { NextRequest } from 'next/server'
import { mapTilesObjectUrl, proxyTiles } from '@/lib/map/tileProxy'

export const dynamic = 'force-dynamic'

/**
 * The country archive: the lower 48 at zooms 0 to 6, so the map can open on
 * the whole US with state lines and coasts. Extracted from the public
 * Protomaps daily build (see docs/blacqlist/map-tiles.md). Covered by the same
 * proxy.ts matcher exclusion as /api/map/tiles.
 */
export async function GET(request: NextRequest) {
  return proxyTiles(
    request,
    process.env.MAP_TILES_US_UPSTREAM_URL ?? mapTilesObjectUrl('blacqlist-us-lowzoom.pmtiles')
  )
}
