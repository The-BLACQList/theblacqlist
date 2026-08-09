import { describe, expect, it } from 'vitest'

import { resolveCoverImage } from '@/lib/listings/coverImage'
import { hashString } from '@/lib/utils'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const LISTING_ID = '3f2a1b4c-5d6e-4f70-8912-abcdef012345'

describe('resolveCoverImage', () => {
  it('resolves a Storage path to the public listing-media URL', () => {
    const { src } = resolveCoverImage('abc/cover.jpg', 'business', LISTING_ID)
    expect(src).toBe(`${SUPABASE_URL}/storage/v1/object/public/listing-media/abc/cover.jpg`)
  })

  it('passes through a value that is already a full URL', () => {
    const url = 'https://cdn.example.com/cover.jpg'
    expect(resolveCoverImage(url, 'business', LISTING_ID).src).toBe(url)
  })

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['empty string', ''],
  ])('returns src=null for %s so the caller renders the F-1 fallback', (_label, value) => {
    expect(resolveCoverImage(value, 'business', LISTING_ID).src).toBeNull()
  })

  // The declined DEFAULT_COVERS strategy substituted a stock photo per
  // entity_type when a listing had no cover of its own. Nothing may reintroduce
  // that: a photograph on a named business implies it depicts that business.
  // See living-commerce-index.md:63 and the 2026-08-09 decision.
  it.each(['business', 'restaurant', 'service_provider', 'professional', 'creative', 'vendor', 'event', 'unknown_type', null])(
    'never substitutes a default photo for entity_type %s',
    (entityType) => {
      expect(resolveCoverImage(null, entityType, LISTING_ID).src).toBeNull()
    }
  )

  it('does not vary by listing id — there is no per-id photo rotation left', () => {
    const a = resolveCoverImage(null, 'business', 'id-one')
    const b = resolveCoverImage(null, 'business', 'id-two')
    expect(a.src).toBe(b.src)
  })
})

describe('hashString', () => {
  it('is deterministic, so SSR and the client agree on the node field', () => {
    expect(hashString(LISTING_ID)).toBe(hashString(LISTING_ID))
  })

  it('returns a non-negative 32-bit integer', () => {
    for (const input of [LISTING_ID, '', 'a', 'Ünïcødé ✦', 'x'.repeat(500)]) {
      const h = hashString(input)
      expect(Number.isInteger(h)).toBe(true)
      expect(h).toBeGreaterThanOrEqual(0)
      expect(h).toBeLessThanOrEqual(0xffffffff)
    }
  })

  it('separates distinct inputs, including the axis-keyed seeds ImageFallback uses', () => {
    const seeds = ['x0', 'y0', 'x1', 'y1', 'x2', 'y2', 'x3', 'y3', 'x4', 'y4'].map((axis) =>
      hashString(`${LISTING_ID}:${axis}`)
    )
    expect(new Set(seeds).size).toBe(seeds.length)
  })

  it('produces different node placements for different listings', () => {
    const placement = (id: string) => hashString(`${id}:x0`) % 23
    const ids = Array.from({ length: 40 }, (_, i) => `listing-${i}-${'ab'.repeat(i % 5)}`)
    // Not all 40 need to differ, but a single shared value across the grid is
    // the wallpaper failure the seed exists to prevent.
    expect(new Set(ids.map(placement)).size).toBeGreaterThan(5)
  })
})
