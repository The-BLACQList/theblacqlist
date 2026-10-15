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
//
//   • 2026-10-14 (founder: "map imagery now takes too long"): the map stopped
//     using Range requests. It asks /api/map/tiles/v1/metros/{z}/{x}/{y} for
//     plain tiles, which the CDN can keep. The old Range route above stays for
//     tabs opened before that deploy.
// =============================================================================

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, it, expect } from 'vitest'

import { MAX_TILE_ZOOM, parseTileRequest, tileTemplate, TILES_VERSION } from '@/lib/map/tileUrls'

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

describe('plain tile URLs', () => {
  const ok = { version: TILES_VERSION, archive: 'metros', z: '11', x: '536', y: '820' }

  it('builds a versioned z/x/y template on the page origin', () => {
    expect(tileTemplate('https://example.test', 'metros')).toBe(
      `https://example.test/api/map/tiles/${TILES_VERSION}/metros/{z}/{x}/{y}`
    )
  })

  it('reads a real tile address', () => {
    expect(parseTileRequest(ok)).toEqual({ archive: 'metros', z: 11, x: 536, y: 820 })
    expect(parseTileRequest({ ...ok, z: '0', x: '0', y: '0' })).toEqual({ archive: 'metros', z: 0, x: 0, y: 0 })
  })

  it('reads the country file too', () => {
    expect(parseTileRequest({ ...ok, archive: 'us', z: '4', x: '3', y: '6' })).toEqual({ archive: 'us', z: 4, x: 3, y: 6 })
  })

  it('keeps an older version working, so open tabs survive a bump', () => {
    expect(parseTileRequest({ ...ok, version: 'v0' })).not.toBeNull()
  })

  it.each([
    ['a bad version', { version: 'latest' }],
    ['an unknown file', { archive: 'world' }],
    ['a zoom deeper than any file', { z: String(MAX_TILE_ZOOM + 1), x: '0', y: '0' }],
    ['x off the edge', { z: '2', x: '4', y: '0' }],
    ['y off the edge', { z: '2', x: '0', y: '4' }],
    ['a negative number', { x: '-1' }],
    ['a decimal', { y: '820.5' }],
    ['a file extension', { y: '820.pbf' }],
    ['an empty segment', { z: '' }],
  ])('refuses %s', (_label, patch) => {
    expect(parseTileRequest({ ...ok, ...patch })).toBeNull()
  })
})

describe('plain tiles route', () => {
  const src = read('app/api/map/tiles/[version]/[archive]/[z]/[x]/[y]/route.ts')

  it('lets the CDN keep tiles', () => {
    expect(src).toContain("'Cache-Control': 'public, max-age=86400, s-maxage=31536000, immutable'")
  })

  it('never caches an error', () => {
    for (const m of src.matchAll(/status: (404|502)[^)]*/g)) expect(m[0]).toContain('no-store')
  })

  it('answers a missing tile with 200, since the CDN does not keep 204', () => {
    expect(src).not.toMatch(/status:\s*204/)
  })

  it('is used by the map, not the Range route', () => {
    const explore = read('components/map/MapExplore.tsx')
    expect(explore).toContain("tileTemplate(window.location.origin, 'metros')")
    expect(explore).toContain("tileTemplate(window.location.origin, 'us')")
    expect(explore).not.toContain('pmtiles://')
    expect(read('components/map/mapStyle.ts')).not.toContain('pmtiles://')
  })
})
