// =============================================================================
// "Open to partnerships" filter and badges (ticket 134)
// =============================================================================
// [Decision — founder, 2026-10-20] Cards say "Open to partnerships", creators
// say "Open to brand deals", and the page spells it out in full.
// The filter is a deep facet: only search_listings_faceted can express it, so
// it must keep the request on the RPC path and never be dropped by the legacy
// PostgREST fallback.
// =============================================================================

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, it, expect } from 'vitest'

import { hasFacetFilters, parseDiscoverParams } from '@/lib/listings/discover-params'
import { partnershipLine, partnershipPill } from '@/lib/listings/partnerships'
import { rpcArgs } from '@/lib/listings/facets'
import { searchSchema } from '@/lib/validations/search'

const src = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8')

describe('partners URL param', () => {
  it('reads partners=1 as on', () => {
    expect(parseDiscoverParams({ partners: '1' }).partners).toBe(true)
  })

  it('reads anything else as off', () => {
    expect(parseDiscoverParams({}).partners).toBe(false)
    expect(parseDiscoverParams({ partners: '0' }).partners).toBe(false)
    expect(parseDiscoverParams({ partners: 'yes' }).partners).toBe(false)
  })

  it('is accepted by /api/search with the open_now spellings', () => {
    expect(searchSchema.parse({ partners: '1' }).partners).toBe(true)
    expect(searchSchema.parse({ partners: 'true' }).partners).toBe(true)
    expect(searchSchema.parse({ partners: '0' }).partners).toBe(false)
    expect(searchSchema.safeParse({ partners: 'maybe' }).success).toBe(false)
  })
})

describe('partners RPC argument', () => {
  it('is left off the call when the filter is off', () => {
    expect('p_open_to_partnerships' in rpcArgs({ p_q: 'x', p_open_to_partnerships: null })).toBe(
      false
    )
  })

  it('is sent as true when the filter is on', () => {
    expect(rpcArgs({ p_open_to_partnerships: true }).p_open_to_partnerships).toBe(true)
  })

  // A retry without the type keys must not quietly widen a partners search.
  it('never retries without it', () => {
    expect(src('lib/listings/facets.ts')).toMatch(
      /'p_open_to_partnerships' in args\s*\)\s*return first/
    )
  })

  it('keeps a filtered request on the RPC path', () => {
    expect(src('lib/listings/query.ts')).toMatch(/resolved\.p_open_to_partnerships \|\|/)
    expect(src('lib/services/search.ts')).toMatch(/resolved\.p_open_to_partnerships \|\|/)
  })
})

describe('partnership badge wording', () => {
  it('says nothing when the switch is off', () => {
    expect(partnershipPill('business', false)).toBeNull()
    expect(partnershipPill('creator', undefined)).toBeNull()
    expect(partnershipLine('business', false)).toBeNull()
  })

  it('reads "Open to brand deals" on creator cards and pages', () => {
    expect(partnershipPill('creator', true)).toBe('Open to brand deals')
    expect(partnershipLine('creator', true)).toBe('Open to brand deals')
  })

  it('reads "Open to partnerships" on every other card', () => {
    for (const type of ['business', 'restaurant', 'event', 'service_provider'] as const) {
      expect(partnershipPill(type, true)).toBe('Open to partnerships')
    }
  })

  it('spells it out on the page', () => {
    expect(partnershipLine('business', true)).toBe('Open to creator partnerships and sponsorships')
  })

  it('shows on the card and the page rail with an icon beside the text', () => {
    expect(src('components/entities/EntityCard.tsx')).toMatch(/partnershipPill\(/)
    expect(src('components/entity-page/templates/TemplateInfoRail.tsx')).toMatch(
      /partnershipLine\(/
    )
  })
})

describe('the filtered empty state', () => {
  it('counts partners, open-now spellings and the other sidebar keys as filters', () => {
    expect(hasFacetFilters({ partners: '1' })).toBe(true)
    expect(hasFacetFilters({ open_now: '1' })).toBe(true)
    expect(hasFacetFilters({ open: 'now' })).toBe(true)
    expect(hasFacetFilters({ type: 'creator' })).toBe(true)
    expect(hasFacetFilters({ attrs: 'delivery' })).toBe(true)
  })

  it('does not count a search, Near You, sort or page as a filter', () => {
    expect(hasFacetFilters({})).toBe(false)
    expect(
      hasFacetFilters({
        q: 'tea',
        lat: '33.7',
        lng: '-84.3',
        radius: '10',
        sort: 'name',
        page: '2',
      })
    ).toBe(false)
  })

  it('offers Clear filters on both Discover pages', () => {
    const grid = src('components/discovery/DiscoveryGrid.tsx')
    expect(grid).toContain('No results for these filters')
    expect(grid).toMatch(/Clear filters/)
    for (const page of [
      'app/(public)/discover/(index)/page.tsx',
      'app/(public)/discover/[citySlug]/page.tsx',
    ]) {
      expect(src(page)).toContain('filtersActive={hasFacetFilters(params)}')
    }
  })
})
