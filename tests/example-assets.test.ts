import { describe, expect, it } from 'vitest'

import { resolveCoverImage } from '@/lib/listings/coverImage'
import {
  EXAMPLE_ASSET_PATH,
  isExampleAssetPath,
  resolveEntityCover,
} from '@/lib/listings/exampleAssets'

const LISTING_ID = 'example-storefront'

// Every input a cover path can plausibly take. In live mode the scoped resolver
// must return exactly what resolveCoverImage returns for each one — the sample
// page exception must not reach a real listing.
const LIVE_INPUTS: Array<[string, string | null | undefined]> = [
  ['null', null],
  ['undefined', undefined],
  ['empty string', ''],
  ['https URL', 'https://cdn.example.com/cover.jpg'],
  ['storage key', 'abc/cover.jpg'],
  ['example asset', '/images/example/cafe-cover.webp'],
  ['editorial asset', '/images/editorial/atlanta.webp'],
]

describe('resolveEntityCover in live mode', () => {
  it.each(LIVE_INPUTS)('matches resolveCoverImage for %s', (_label, value) => {
    expect(resolveEntityCover(value, 'restaurant', LISTING_ID, 'live')).toEqual(
      resolveCoverImage(value, 'restaurant', LISTING_ID)
    )
  })

  it('defaults to live mode when no mode is passed', () => {
    const path = '/images/example/cafe-cover.webp'
    expect(resolveEntityCover(path, 'restaurant', LISTING_ID)).toEqual(
      resolveCoverImage(path, 'restaurant', LISTING_ID)
    )
    // And that live result is NOT the asset itself — it is the storage-key branch.
    expect(resolveEntityCover(path, 'restaurant', LISTING_ID).src).not.toBe(path)
  })
})

describe('resolveEntityCover in example mode', () => {
  it('passes an example asset through as its own src', () => {
    const path = '/images/example/cafe-cover.webp'
    expect(resolveEntityCover(path, 'restaurant', LISTING_ID, 'example')).toEqual({ src: path })
  })

  it.each([
    ['null', null],
    ['storage key', 'abc/cover.jpg'],
    ['https URL', 'https://cdn.example.com/cover.jpg'],
    ['editorial asset', '/images/editorial/atlanta.webp'],
  ])('still applies the live rule to %s', (_label, value) => {
    expect(resolveEntityCover(value, 'restaurant', LISTING_ID, 'example')).toEqual(
      resolveCoverImage(value, 'restaurant', LISTING_ID)
    )
  })
})

describe('EXAMPLE_ASSET_PATH', () => {
  it.each([
    '/images/example/cafe-cover.webp',
    '/images/example/dish-1.jpg',
    '/images/example/a.png',
    '/images/example/work-sample-04.jpeg',
  ])('accepts %s', (path) => {
    expect(isExampleAssetPath(path)).toBe(true)
  })

  it.each([
    ['path traversal', '/images/example/../editorial/x.webp'],
    ['nested folder', '/images/example/sub/x.webp'],
    ['uppercase', '/images/example/Cafe.webp'],
    ['query string', '/images/example/cafe.webp?v=1'],
    ['wrong folder', '/images/editorial/cafe.webp'],
    ['relative', 'images/example/cafe.webp'],
    ['absolute URL', 'https://example.com/images/example/cafe.webp'],
    ['svg', '/images/example/logo.svg'],
    ['no extension', '/images/example/cafe'],
    ['underscore', '/images/example/cafe_cover.webp'],
  ])('rejects %s', (_label, path) => {
    expect(EXAMPLE_ASSET_PATH.test(path)).toBe(false)
    expect(isExampleAssetPath(path)).toBe(false)
  })

  it('rejects non-strings', () => {
    expect(isExampleAssetPath(null)).toBe(false)
    expect(isExampleAssetPath(undefined)).toBe(false)
  })
})
