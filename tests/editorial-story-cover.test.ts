import { describe, expect, it } from 'vitest'

import { resolveStoryCover } from '@/lib/editorial/cover'
import { resolveMediaPath } from '@/lib/listings/coverImage'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''

describe('resolveStoryCover', () => {
  it('renders a licensed editorial photo as a site path', () => {
    expect(resolveStoryCover('/images/editorial/bbq-plate.webp')).toBe(
      '/images/editorial/bbq-plate.webp'
    )
  })

  it('still resolves a Storage key and passes a full URL through', () => {
    expect(resolveStoryCover('stories/cover.jpg')).toBe(
      `${SUPABASE_URL}/storage/v1/object/public/listing-media/stories/cover.jpg`
    )
    expect(resolveStoryCover('https://cdn.example.com/c.jpg')).toBe('https://cdn.example.com/c.jpg')
  })

  it.each([null, undefined, ''])('returns null for %s', (value) => {
    expect(resolveStoryCover(value)).toBeNull()
  })

  it.each([
    '/images/editorial/../brand/logo.svg',
    '/images/editorial/categories/x.webp',
    '/images/cities/atlanta.webp',
    '/images/editorial/x.svg',
  ])('does not treat %s as an editorial photo', (path) => {
    expect(resolveStoryCover(path)).toBe(resolveMediaPath(path))
  })
})

describe('resolveMediaPath', () => {
  // Listing covers and logos go through resolveMediaPath. It must not pick up
  // the editorial pool: the Canva license forbids a pool photo on a listing.
  it('does not pass an editorial pool path through for listings', () => {
    expect(resolveMediaPath('/images/editorial/bbq-plate.webp')).not.toBe(
      '/images/editorial/bbq-plate.webp'
    )
  })
})
