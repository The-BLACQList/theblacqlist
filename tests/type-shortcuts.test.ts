// =============================================================================
// lib/listings/type-shortcuts.ts: the one mapping behind the discover Type chips
// =============================================================================
// Every imported listing is `entity_type='business'`, so the Restaurants,
// Services, Professionals and Creatives chips returned zero until the mapping
// existed [Decision - founder, 2026-09-24]. These tests pin the helpers every
// caller shares (SQL args, PostgREST browse path, homepage counts, sponsored
// filter, sidebar count rollup) and check every mapped slug against the seed so
// a renamed category cannot silently turn a chip back to zero.
// =============================================================================

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, it, expect } from 'vitest'

import {
  TYPE_CATEGORY_SLUGS,
  TYPE_LOCATION_TYPES,
  expandTypeCategoryIds,
  isMappedType,
  listingMatchesType,
  parseCellKey,
  rollupCells,
  typeOrFilter,
  type CategoryNode,
  type FacetCell,
} from '@/lib/listings/type-shortcuts'
import { PRODUCTS_SERVICES_LOCATION_TYPES } from '@/lib/constants/listing'

const FOOD = 'food-0000'
const BAKERY = 'food-bake'
const PHOTO = 'photo-000'
const RETAIL = 'retail-000'
const HEALTH = 'health-000'

const CATS: CategoryNode[] = [
  { id: FOOD, slug: 'food-dining', parent_id: null },
  { id: BAKERY, slug: 'bakeries', parent_id: FOOD },
  { id: PHOTO, slug: 'photography-videography', parent_id: null },
  { id: RETAIL, slug: 'retail-gifts', parent_id: null },
  { id: HEALTH, slug: 'healthcare', parent_id: null },
]

const listing = (
  entity_type: string,
  category_id: string | null,
  location_type: string | null = 'physical'
) => ({
  entity_type,
  category_id,
  location_type,
})

describe('mapping', () => {
  it('maps the four empty chips and leaves the rest exact', () => {
    expect(isMappedType('restaurant')).toBe(true)
    expect(isMappedType('professional')).toBe(true)
    expect(isMappedType('creative')).toBe(true)
    expect(isMappedType('service_provider')).toBe(true)
    for (const exact of ['business', 'event', 'job', 'vendor', '', null, undefined]) {
      expect(isMappedType(exact)).toBe(false)
    }
  })

  it('reads Services from the same constant as the homepage avenue', () => {
    expect(TYPE_LOCATION_TYPES.service_provider).toBe(PRODUCTS_SERVICES_LOCATION_TYPES)
  })
})

describe('every mapped slug exists as a top-level category in supabase/seed.sql', () => {
  const seed = readFileSync(resolve(process.cwd(), 'supabase/seed.sql'), 'utf8')
  // Top-level rows carry `NULL` as parent_id, the fourth column.
  const topLevel = new Set(
    [...seed.matchAll(/\('[0-9a-f-]+',\s*'[^']*',\s*'([a-z0-9-]+)',\s*NULL,/g)].map(
      (m) => m[1] ?? ''
    )
  )

  it('finds the seed rows at all', () => {
    expect(topLevel.size).toBeGreaterThanOrEqual(20)
  })

  for (const [type, slugs] of Object.entries(TYPE_CATEGORY_SLUGS)) {
    for (const slug of slugs ?? []) {
      it(`${type} -> ${slug}`, () => {
        expect(topLevel.has(slug)).toBe(true)
      })
    }
  }
})

describe('expandTypeCategoryIds', () => {
  it('returns each mapped parent plus its children', () => {
    expect(expandTypeCategoryIds('restaurant', CATS).sort()).toEqual([BAKERY, FOOD].sort())
  })

  it('returns nothing for an unmapped or location-only type', () => {
    expect(expandTypeCategoryIds('business', CATS)).toEqual([])
    expect(expandTypeCategoryIds('service_provider', CATS)).toEqual([])
    expect(expandTypeCategoryIds(null, CATS)).toEqual([])
  })

  it('skips mapped slugs missing from the category list', () => {
    // professional maps four parents; only healthcare is in this fixture.
    expect(expandTypeCategoryIds('professional', CATS)).toEqual([HEALTH])
  })
})

describe('listingMatchesType', () => {
  const food = expandTypeCategoryIds('restaurant', CATS)

  it('matches the exact entity type, a mapped category, or a child of one', () => {
    expect(listingMatchesType('restaurant', listing('restaurant', null), food)).toBe(true)
    expect(listingMatchesType('restaurant', listing('business', FOOD), food)).toBe(true)
    expect(listingMatchesType('restaurant', listing('business', BAKERY), new Set(food))).toBe(true)
  })

  it('does not match an unrelated category', () => {
    expect(listingMatchesType('restaurant', listing('business', RETAIL), food)).toBe(false)
    expect(listingMatchesType('restaurant', listing('business', null), food)).toBe(false)
  })

  it('matches Services by location type only', () => {
    expect(listingMatchesType('service_provider', listing('business', RETAIL, 'virtual'), [])).toBe(
      true
    )
    expect(
      listingMatchesType('service_provider', listing('business', RETAIL, 'physical'), [])
    ).toBe(false)
    expect(listingMatchesType('service_provider', listing('business', RETAIL, null), [])).toBe(
      false
    )
  })

  it('keeps business exact', () => {
    expect(listingMatchesType('business', listing('business', FOOD), [])).toBe(true)
    expect(listingMatchesType('business', listing('event', FOOD), [])).toBe(false)
  })
})

describe('typeOrFilter', () => {
  it('builds the PostgREST or-filter for a category-mapped type', () => {
    expect(typeOrFilter('restaurant', [FOOD, BAKERY])).toBe(
      `entity_type.eq.restaurant,category_id.in.(${FOOD},${BAKERY})`
    )
  })

  it('builds the location clause for Services', () => {
    expect(typeOrFilter('service_provider', [])).toBe(
      `entity_type.eq.service_provider,location_type.in.(${PRODUCTS_SERVICES_LOCATION_TYPES.join(',')})`
    )
  })

  it('is just the exact clause for an unmapped type', () => {
    expect(typeOrFilter('business', [])).toBe('entity_type.eq.business')
  })

  it('refuses anything that could break out of the filter syntax', () => {
    expect(() => typeOrFilter('restaurant),id.eq.(x', [])).toThrow()
    expect(typeOrFilter('restaurant', [FOOD, 'x),or(id.eq.1'])).toBe(
      `entity_type.eq.restaurant,category_id.in.(${FOOD})`
    )
  })
})

describe('parseCellKey', () => {
  it('parses a full key and turns empty segments into null', () => {
    expect(parseCellKey(`business|${FOOD}|physical`, 4)).toEqual({
      entity_type: 'business',
      category_id: FOOD,
      location_type: 'physical',
      count: 4,
    })
    expect(parseCellKey('business||', 2)).toEqual({
      entity_type: 'business',
      category_id: null,
      location_type: null,
      count: 2,
    })
  })

  it('rejects malformed keys', () => {
    expect(parseCellKey('business', 1)).toBeNull()
    expect(parseCellKey('|a|b', 1)).toBeNull()
    expect(parseCellKey('a|b|c|d', 1)).toBeNull()
  })
})

describe('rollupCells', () => {
  const cells: FacetCell[] = [
    { entity_type: 'business', category_id: FOOD, location_type: 'physical', count: 5 },
    { entity_type: 'business', category_id: BAKERY, location_type: 'physical', count: 2 },
    { entity_type: 'business', category_id: PHOTO, location_type: 'virtual', count: 3 },
    { entity_type: 'business', category_id: RETAIL, location_type: 'physical', count: 7 },
    { entity_type: 'event', category_id: null, location_type: null, count: 1 },
  ]
  const types = ['business', 'restaurant', 'service_provider', 'creative', 'event']

  it('counts a parent as itself plus its children', () => {
    const { category } = rollupCells(cells, CATS, { types })
    expect(category['food-dining']).toBe(7)
    expect(category.bakeries).toBe(2)
    expect(category['photography-videography']).toBe(3)
    expect(category['retail-gifts']).toBe(7)
  })

  it('counts each type through the mapping', () => {
    const { type } = rollupCells(cells, CATS, { types })
    expect(type).toEqual({
      business: 17,
      restaurant: 7,
      service_provider: 3,
      creative: 3,
      event: 1,
    })
  })

  it('narrows category counts by the active type but not by the active category', () => {
    const { category } = rollupCells(cells, CATS, {
      types,
      activeType: 'restaurant',
      activeCategoryId: FOOD,
    })
    expect(category['food-dining']).toBe(7)
    expect(category['retail-gifts']).toBeUndefined()
  })

  it('narrows type counts by the active category, children included', () => {
    const { type } = rollupCells(cells, CATS, { types, activeCategoryId: FOOD })
    expect(type).toEqual({ business: 7, restaurant: 7, service_provider: 0, creative: 0, event: 0 })
  })

  it('reports zero for every requested type when there are no cells', () => {
    expect(rollupCells([], CATS, { types }).type).toEqual({
      business: 0,
      restaurant: 0,
      service_provider: 0,
      creative: 0,
      event: 0,
    })
  })
})
