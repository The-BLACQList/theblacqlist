import type { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * Same-origin proxy for the self-hosted PMTiles archive. Browsers can't read
 * the Content-Range header from Supabase Storage cross-origin (not in
 * Access-Control-Expose-Headers), which silently stalls the pmtiles client —
 * proxying through our own origin removes CORS from the equation entirely.
 * Range requests pass through; responses are long-cache (the archive is
 * versioned by replacement, not mutation).
 */
export async function GET(request: NextRequest) {
  const upstream =
    process.env.MAP_TILES_UPSTREAM_URL ??
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/map-tiles/blacqlist-metros.pmtiles`

  const range = request.headers.get('range')
  const res = await fetch(upstream, {
    headers: range ? { Range: range } : undefined,
    cache: 'no-store',
  })

  if (!res.ok && res.status !== 206) {
    return new Response('Tile source unavailable', { status: 502 })
  }

  const headers = new Headers()
  for (const name of ['content-range', 'content-length', 'content-type', 'accept-ranges', 'etag']) {
    const value = res.headers.get(name)
    if (value) headers.set(name, value)
  }
  headers.set('Cache-Control', 'public, max-age=86400')
  return new Response(res.body, { status: res.status, headers })
}
