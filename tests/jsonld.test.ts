/**
 * Pins the LocalBusiness JSON-LD builder's output as it was the day it moved
 * out of the listing page (ticket 184, PR 1B). The move promised no change in
 * output; this is that promise as a test. Ticket 189 enriches the builder and
 * rewrites these expectations deliberately, quirks included.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

import { buildExampleEntity } from '@/lib/example/fixtures'
import { DEFAULT_SITE_URL, buildJsonLd, siteBaseUrl } from '@/lib/listings/jsonLd'
import { buildEntityUrl } from '@/lib/listings/url'
import type { EntityPageData } from '@/types'

const NOW = new Date('2026-11-13T12:00:00Z')
const BASE = 'https://preview.example'

function full(): EntityPageData {
  return buildExampleEntity('storefront', NOW)
}

function bare(): EntityPageData {
  const entity = full()
  return {
    ...entity,
    logo_path: null,
    avg_rating: null,
    details: {
      ...entity.details,
      description: '',
      address: null,
      address_line2: null,
      phone: null,
      website_url: null,
    },
  }
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('buildJsonLd', () => {
  it('is null for a missing listing', () => {
    expect(buildJsonLd(null, 'business', BASE)).toBeNull()
  })

  it('emits exactly the shape the listing page emitted before the move', () => {
    const entity = full()
    expect(entity.details.address_line2).toBeTruthy()
    expect(buildJsonLd(entity, entity.entity_type, BASE)).toEqual({
      '@context': 'https://schema.org',
      '@type': 'LocalBusiness',
      name: entity.name,
      description: entity.details.description,
      url: `${BASE}${buildEntityUrl(entity.entity_type, entity.city?.slug, entity.slug)}`,
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: entity.avg_rating!.toFixed(1),
        reviewCount: entity.review_count,
      },
      address: {
        '@type': 'PostalAddress',
        streetAddress: entity.details.address,
        // address_line2 is dropped today: the city overwrites it. Ticket 189.
        addressLocality: entity.details.city_name,
        addressRegion: entity.details.state_abbr,
        postalCode: entity.details.zip,
        addressCountry: 'US',
      },
      telephone: entity.details.phone,
      sameAs: entity.details.website_url,
    })
  })

  it('falls back to the tagline and omits every optional property on a bare listing', () => {
    const entity = bare()
    expect(buildJsonLd(entity, entity.entity_type, BASE)).toEqual({
      '@context': 'https://schema.org',
      '@type': 'LocalBusiness',
      name: entity.name,
      description: entity.tagline,
      url: `${BASE}${buildEntityUrl(entity.entity_type, entity.city?.slug, entity.slug)}`,
    })
  })

  it('formats the rating to one decimal and keeps the review count a number', () => {
    const entity = { ...full(), avg_rating: 4.666, review_count: 7 }
    const rating = buildJsonLd(entity, entity.entity_type, BASE)?.aggregateRating
    expect(rating).toEqual({ '@type': 'AggregateRating', ratingValue: '4.7', reviewCount: 7 })
  })

  it('emits no aggregateRating for an average of exactly 0 (truthiness quirk, kept)', () => {
    const entity = { ...full(), avg_rating: 0 }
    expect(buildJsonLd(entity, entity.entity_type, BASE)).not.toHaveProperty('aggregateRating')
  })

  it('passes an absolute logo URL through and resolves a storage key to the public bucket', () => {
    const absolute = { ...full(), logo_path: 'https://cdn.example/logo.png' }
    expect(buildJsonLd(absolute, absolute.entity_type, BASE)?.logo).toBe(
      'https://cdn.example/logo.png'
    )

    const key = { ...full(), logo_path: 'logos/abc.png' }
    expect(buildJsonLd(key, key.entity_type, BASE)?.logo).toMatch(
      /\/storage\/v1\/object\/public\/listing-media\/logos\/abc\.png$/
    )
  })

  it('falls back to the city row when the details carry no locality or region', () => {
    const entity = full()
    const withoutLocality = {
      ...entity,
      details: { ...entity.details, city_name: null, state_abbr: null },
    }
    const address = buildJsonLd(withoutLocality, entity.entity_type, BASE)?.address as Record<
      string,
      unknown
    >
    expect(address.addressLocality).toBe(entity.city?.name)
    expect(address.addressRegion).toBe(entity.city?.state_abbr)
  })

  it('derives the default base URL from the site env, as every absolute URL does', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://staging.example')
    expect(siteBaseUrl()).toBe('https://staging.example')
    const entity = full()
    expect(buildJsonLd(entity, entity.entity_type)?.url).toMatch(/^https:\/\/staging\.example\//)

    vi.stubEnv('NEXT_PUBLIC_SITE_URL', undefined)
    expect(siteBaseUrl()).toBe(DEFAULT_SITE_URL)
  })
})
