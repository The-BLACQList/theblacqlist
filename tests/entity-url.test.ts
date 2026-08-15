import { describe, expect, it } from 'vitest'
import { buildEntityUrl } from '@/lib/listings/url'

describe('buildEntityUrl', () => {
  it('builds the three-segment city URL', () => {
    expect(buildEntityUrl('business', 'atlanta', 'sweet-auburn-bread')).toBe(
      '/atlanta/business/sweet-auburn-bread'
    )
  })

  it('uses the reserved online segment when the entity has no city', () => {
    // Must stay three segments: /{entityType}/{listingSlug} is captured by the
    // app/[citySlug]/[entityType] category route and 404s (defect 1.8).
    expect(buildEntityUrl('business', null, 'virtual-consulting')).toBe(
      '/online/business/virtual-consulting'
    )
    expect(buildEntityUrl('creative', undefined, 'remote-studio')).toBe(
      '/online/creative/remote-studio'
    )
  })

  it('treats an empty city slug as city-less rather than emitting a blank segment', () => {
    expect(buildEntityUrl('business', '', 'no-city-biz')).toBe('/online/business/no-city-biz')
  })
})
