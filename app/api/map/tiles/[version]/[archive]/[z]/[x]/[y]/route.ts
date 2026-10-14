import { gzipSync } from 'node:zlib'
import { FetchSource, PMTiles } from 'pmtiles'
import { parseTileRequest, type TileArchive } from '@/lib/map/tileUrls'

export const dynamic = 'force-dynamic'

/**
 * Where each archive lives. MAP_TILES_UPSTREAM_URL overrides the metro file,
 * MAP_TILES_US_UPSTREAM_URL the country file (docs/blacqlist/map-tiles.md).
 */
function upstreamUrl(archive: TileArchive): string {
  switch (archive) {
    case 'metros':
      return (
        process.env.MAP_TILES_UPSTREAM_URL ??
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/map-tiles/blacqlist-metros.pmtiles`
      )
    case 'us':
      return (
        process.env.MAP_TILES_US_UPSTREAM_URL ??
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/map-tiles/blacqlist-us-lowzoom.pmtiles`
      )
  }
}

// One reader per archive for the life of the server instance. It keeps the
// file's header and directories in memory, so a warm instance reads one byte
// range per tile and nothing else.
const readers = new Map<TileArchive, PMTiles>()
function reader(archive: TileArchive): PMTiles {
  let r = readers.get(archive)
  if (!r) {
    r = new PMTiles(new FetchSource(upstreamUrl(archive)))
    readers.set(archive, r)
  }
  return r
}

/**
 * One basemap tile as a plain, cacheable response (see lib/map/tileUrls.ts).
 * 200 with gzip MVT bytes, or 200 with an empty body where the file has no
 * tile (open sea, outside the metros). Vercel's CDN does not cache 204, and an
 * empty tile is a real answer worth caching. Errors are never cached.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ version: string; archive: string; z: string; x: string; y: string }> }
) {
  const tile = parseTileRequest(await params)
  if (!tile) return new Response('Not a tile', { status: 404, headers: { 'Cache-Control': 'no-store' } })

  let data: ArrayBuffer | undefined
  try {
    data = (await reader(tile.archive).getZxy(tile.z, tile.x, tile.y))?.data
  } catch (err) {
    console.warn('[map] tile read failed', tile, err instanceof Error ? err.message : err)
    return new Response('Tile source unavailable', { status: 502, headers: { 'Cache-Control': 'no-store' } })
  }

  const headers = new Headers({
    'Content-Type': 'application/vnd.mapbox-vector-tile',
    // Browser: a day. CDN: a year. Tile URLs carry TILES_VERSION, so a
    // replaced file gets new URLs instead of waiting out either cache.
    'Cache-Control': 'public, max-age=86400, s-maxage=31536000, immutable',
  })
  if (!data || data.byteLength === 0) return new Response(null, { status: 200, headers })

  // The reader hands back the tile unzipped. Zip it again for the wire: MVT
  // shrinks to roughly a third, and the CDN stores the zipped copy.
  headers.set('Content-Encoding', 'gzip')
  headers.set('Vary', 'Accept-Encoding')
  const body = new Uint8Array(gzipSync(new Uint8Array(data)))
  return new Response(body, { status: 200, headers })
}
