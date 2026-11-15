/**
 * Pins the LocalBusiness JSON-LD builder's output. It moved out of the listing
 * page in ticket 184 unchanged; ticket 189 enriched it (type, hours, geo,
 * image, price range, founding year, socials, offers, events) and fixed the two
 * quirks the move kept: address line 2 and a 0 average.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

import { buildExampleEntity } from '@/lib/example/fixtures'
import {
  DEFAULT_SITE_URL,
  buildJsonLd,
  openingHoursSpecification,
  schemaTypeFor,
  siteBaseUrl,
} from '@/lib/listings/jsonLd'
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
    category: { name: 'Business', slug: 'business' },
    logo_path: null,
    cover_image_path: null,
    avg_rating: null,
    organizerEvents: [],
    hoursOverrides: undefined,
    details: {
      ...entity.details,
      description: '',
      address: null,
      address_line2: null,
      phone: null,
      website_url: null,
      social: Object.fromEntries(
        Object.keys(entity.details.social).map((k) => [k, null])
      ) as unknown as EntityPageData['details']['social'],
      hours: null,
      lat: null,
      lng: null,
      founded_year: null,
      price_range: null,
      accepts_reservations: null,
      services: [],
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

  it('emits the enriched LocalBusiness shape for a full storefront page', () => {
    const entity = full()
    expect(entity.details.address_line2).toBeTruthy()
    const ld = buildJsonLd(entity, entity.entity_type, BASE)!
    expect(ld['@type']).toBe('CafeOrCoffeeShop')
    expect(ld.name).toBe(entity.name)
    expect(ld.description).toBe(entity.details.description)
    expect(ld.url).toBe(
      `${BASE}${buildEntityUrl(entity.entity_type, entity.city?.slug, entity.slug)}`
    )
    expect(ld.image).toBe(`${BASE}${entity.cover_image_path}`)
    expect(ld.aggregateRating).toEqual({
      '@type': 'AggregateRating',
      ratingValue: entity.avg_rating!.toFixed(1),
      reviewCount: entity.review_count,
    })
    expect(ld.address).toEqual({
      '@type': 'PostalAddress',
      // Line 2 now reaches the street line (the old quirk dropped it).
      streetAddress: `${entity.details.address}, ${entity.details.address_line2}`,
      addressLocality: entity.details.city_name,
      addressRegion: entity.details.state_abbr,
      postalCode: entity.details.zip,
      addressCountry: 'US',
    })
    expect(ld.geo).toEqual({
      '@type': 'GeoCoordinates',
      latitude: entity.details.lat,
      longitude: entity.details.lng,
    })
    expect(ld.hasMap).toMatch(/^https:\/\/www\.google\.com\/maps\/dir\/\?api=1&destination=/)
    expect(ld.telephone).toBe(entity.details.phone)
    expect(ld.priceRange).toBe(entity.details.price_range)
    expect(ld.foundingDate).toBe(String(entity.details.founded_year))
    expect(ld.acceptsReservations).toBe(true)
    expect(ld.sameAs).toEqual(
      expect.arrayContaining([entity.details.website_url, entity.details.social.instagram])
    )
  })

  it('groups opening hours by shared times and leaves closed days out', () => {
    expect(
      openingHoursSpecification({
        monday: { open: '09:00', close: '17:00', closed: false },
        tuesday: { open: '09:00', close: '17:00', closed: false },
        wednesday: { open: '09:00', close: '17:00', closed: false },
        thursday: { open: '09:00', close: '17:00', closed: false },
        friday: { open: '09:00', close: '20:00', closed: false },
        saturday: { open: '10:00', close: '14:00', closed: false },
        sunday: { open: '00:00', close: '00:00', closed: true },
      })
    ).toEqual([
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: [
          'https://schema.org/Monday',
          'https://schema.org/Tuesday',
          'https://schema.org/Wednesday',
          'https://schema.org/Thursday',
        ],
        opens: '09:00',
        closes: '17:00',
      },
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: 'https://schema.org/Friday',
        opens: '09:00',
        closes: '20:00',
      },
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: 'https://schema.org/Saturday',
        opens: '10:00',
        closes: '14:00',
      },
    ])
    expect(openingHoursSpecification(null)).toEqual([])
  })

  it('adds the special hours the page shows (ticket 196)', () => {
    const entity = full()
    const ld = buildJsonLd(entity, entity.entity_type, BASE)!
    expect(entity.hoursOverrides?.length).toBeGreaterThan(0)
    expect(ld.specialOpeningHoursSpecification).toHaveLength(entity.hoursOverrides!.length)
  })

  it('lists priced services in an offer catalog, with a number only for a plain price', () => {
    const entity = full()
    const catalog = buildJsonLd(entity, entity.entity_type, BASE)?.hasOfferCatalog as {
      itemListElement: Record<string, unknown>[]
    }
    const offers = catalog.itemListElement
    const priced = entity.details.services.filter((s) => s.price)
    expect(offers).toHaveLength(priced.length)
    const plain = offers.find((o) => (o.itemOffered as { name: string }).name === priced[0]!.name)
    expect(plain).toMatchObject({ price: '3.50', priceCurrency: 'USD' })
    const from = offers.find((o) => o.description === 'From $350')
    expect(from).toBeDefined()
    expect(from).not.toHaveProperty('price')
  })

  it('adds the organizer’s upcoming events with absolute links', () => {
    const entity = full()
    const events = buildJsonLd(entity, entity.entity_type, BASE)?.event as Record<string, unknown>[]
    expect(events).toHaveLength(entity.organizerEvents.length)
    const first = entity.organizerEvents[0]!
    expect(events[0]).toMatchObject({
      '@type': 'Event',
      name: first.name,
      startDate: first.starts_at,
      url: `${BASE}${first.url}`,
      eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    })
  })

  it('maps category slugs to schema.org types, with LocalBusiness as the fallback', () => {
    expect(schemaTypeFor('restaurants')).toBe('Restaurant')
    expect(schemaTypeFor('law-legal-services')).toBe('LegalService')
    expect(schemaTypeFor('accounting-tax-preparation')).toBe('AccountingService')
    expect(schemaTypeFor('hair-salons')).toBe('HairSalon')
    expect(schemaTypeFor('churches-places-of-worship')).toBe('LocalBusiness')
    expect(schemaTypeFor(null)).toBe('LocalBusiness')
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

  it('emits a rating for an average of exactly 0, and none without reviews', () => {
    const zero = { ...full(), avg_rating: 0, review_count: 3 }
    expect(buildJsonLd(zero, zero.entity_type, BASE)?.aggregateRating).toMatchObject({
      ratingValue: '0.0',
    })
    const none = { ...full(), avg_rating: 4.5, review_count: 0 }
    expect(buildJsonLd(none, none.entity_type, BASE)).not.toHaveProperty('aggregateRating')
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
