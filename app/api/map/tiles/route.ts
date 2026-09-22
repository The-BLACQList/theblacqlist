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
  // Browser cache only. Do not add s-maxage here expecting a CDN hit: Vercel's
  // CDN never caches a response to a request that carries a Range header, and
  // only caches 200/404/410/3xx statuses, so every 206 range below is a
  // function invocation regardless of this header (vercel.com/docs/caching/
  // cdn-cache, "Cacheable response criteria", read 2026-09-21). The win for
  // signed-in visitors is the proxy.ts matcher exclusion, not this header.
  headers.set('Cache-Control', 'public, max-age=86400')
  return new Response(res.body, { status: res.status, headers })
}
