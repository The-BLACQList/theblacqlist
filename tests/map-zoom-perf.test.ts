// =============================================================================
// Map zoom: tile requests stay out of the auth proxy
// =============================================================================
// Guards the one change that measurably fixed "the map is laggy on zoom":
//
//   • proxy.ts matcher excludes /api/map/tiles. Every tile byte-range used to
//     run getUser() in the proxy, a Supabase auth round trip per request for
//     any signed-in visitor. Tile TTFB was ~30 ms signed out and ~130 ms
//     signed in on the same machine; with the exclusion it is ~27 ms signed in
//     [Measured - Playwright harness, local dev vs staging, 2026-09-21].
//
//   • The tiles route keeps a browser-only Cache-Control. Adding s-maxage was
//     tried and reverted: Vercel's CDN never caches a response to a request
//     carrying a Range header, so a 206 tile response can never be a CDN hit
//     (vercel.com/docs/caching/cdn-cache, "Cacheable response criteria").
//     Someone re-adding it expecting a win should hit this test first.
// =============================================================================

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, it, expect } from 'vitest'

const read = (rel: string) => readFileSync(resolve(process.cwd(), rel), 'utf8')

describe('proxy matcher', () => {
  const src = read('proxy.ts')

  it('keeps /api/map/tiles out of the auth proxy', () => {
    const matcher = src.match(/matcher:\s*\[([\s\S]*?)\]/)?.[1] ?? ''
    expect(matcher).toContain('api/map/tiles')
  })

  it('still runs on every other API path', () => {
    // The coming-soon gate allowlists /api as a whole; the matcher must not
    // widen the tiles exclusion into a blanket api/ exclusion.
    const matcher = src.match(/matcher:\s*\[([\s\S]*?)\]/)?.[1] ?? ''
    expect(matcher).not.toMatch(/\|api\/?\|/)
    expect(matcher).not.toMatch(/\|api\/\.\*/)
  })
})

describe('tiles route cache header', () => {
  const src = read('app/api/map/tiles/route.ts')

  it('sets a browser cache only', () => {
    expect(src).toContain("headers.set('Cache-Control', 'public, max-age=86400')")
  })

  it('does not ask the CDN to cache a Range response', () => {
    // The route's own comment names s-maxage to explain why it is absent, so
    // inspect the header values that are actually set, not the whole file.
    const values = [...src.matchAll(/headers\.set\(\s*'Cache-Control'\s*,\s*'([^']*)'/g)].map(
      (m) => m[1]
    )
    expect(values).toHaveLength(1)
    for (const v of values) {
      expect(v).not.toMatch(/s-maxage/)
      expect(v).not.toMatch(/stale-while-revalidate/)
    }
  })
})
