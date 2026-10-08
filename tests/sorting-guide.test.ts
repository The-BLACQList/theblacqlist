// =============================================================================
// lib/categories/sorting-guide.ts: the "Help me choose" guide on /add-business
// =============================================================================
// Every slug the guide suggests has to exist, or the owner's best fit quietly
// disappears from the list. The category tree comes from supabase/seed.sql (no
// migration inserts categories), the same source tests/type-shortcuts.test.ts
// checks. The walk-throughs below are the four owners the plan names: a barber,
// a food truck, a lawyer and a candle maker.
// =============================================================================

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect } from 'vitest'

import {
  BEST_FIT_COUNT,
  GUIDE_ANSWERS,
  GUIDE_SEARCH_WORDS,
  GUIDE_TYPE_LABELS,
  GUIDE_WHERE,
  buildGuidePick,
  findAnswer,
  searchGuide,
  suggestCategories,
  suggestEntityType,
  type GuideCategory,
} from '@/lib/categories/sorting-guide'
import { VALID_ENTITY_TYPES, VALID_LOCATION_TYPES } from '@/lib/constants/listing'

const seed = readFileSync(resolve(process.cwd(), 'supabase/seed.sql'), 'utf8')
const ROW = /\('([0-9a-f-]+)',\s*'((?:[^']|'')*)',\s*'([a-z0-9-]+)',\s*(NULL|'[0-9a-f-]+'),/g
const CATS: GuideCategory[] = [...seed.matchAll(ROW)].map((m) => ({
  id: m[1] ?? '',
  name: (m[2] ?? '').replace(/''/g, "'"),
  slug: m[3] ?? '',
  parent_id: m[4] === 'NULL' ? null : (m[4] ?? '').slice(1, -1),
}))
const SLUGS = new Set(CATS.map((cat) => cat.slug))
const bySlug = (slug: string): GuideCategory => {
  const cat = CATS.find((x) => x.slug === slug)
  if (!cat) throw new Error(`no seed category ${slug}`)
  return cat
}

describe('the seed', () => {
  it('parses into a real tree', () => {
    expect(CATS.filter((cat) => cat.parent_id === null).length).toBeGreaterThanOrEqual(20)
    expect(CATS.length).toBeGreaterThan(100)
  })
})

describe('every slug the guide uses exists', () => {
  it.each(GUIDE_ANSWERS.map((a) => [a.id, a.candidates.map((cand) => cand.slug)] as const))(
    'answer %s',
    (_id, slugs) => {
      expect(slugs.filter((s) => !SLUGS.has(s))).toEqual([])
    }
  )

  it('search words', () => {
    const missing = Object.entries(GUIDE_SEARCH_WORDS).flatMap(([word, slugs]) =>
      slugs.filter((s) => !SLUGS.has(s)).map((s) => `${word} -> ${s}`)
    )
    expect(missing).toEqual([])
  })
})

describe('the questions', () => {
  it('give every answer a real choice and unique ids', () => {
    for (const answer of GUIDE_ANSWERS) {
      expect(answer.candidates.length).toBeGreaterThanOrEqual(2)
      expect(new Set(answer.candidates.map((cand) => cand.slug)).size).toBe(
        answer.candidates.length
      )
    }
    expect(new Set(GUIDE_ANSWERS.map((a) => a.id)).size).toBe(GUIDE_ANSWERS.length)
  })

  it('map "Where" to real location types', () => {
    for (const where of GUIDE_WHERE) {
      expect(VALID_LOCATION_TYPES).toContain(where.locationType)
    }
  })

  it('only suggest listing types the form offers', () => {
    for (const type of Object.keys(GUIDE_TYPE_LABELS)) {
      expect(VALID_ENTITY_TYPES).toContain(type)
    }
    expect(GUIDE_TYPE_LABELS).not.toHaveProperty('event')
    expect(GUIDE_TYPE_LABELS).not.toHaveProperty('job')
  })
})

describe('suggestCategories', () => {
  const food = findAnswer('food')!

  it('puts the best fits for "where" first', () => {
    expect(suggestCategories(food, 'popups', CATS).best[0]?.slug).toBe('food-trucks')
    expect(suggestCategories(food, 'come_to_them', CATS).best[0]?.slug).toBe('catering-events-food')
    expect(suggestCategories(food, 'visit', CATS).best[0]?.slug).toBe('restaurants')
  })

  it('shows a few up front and keeps the rest behind More', () => {
    const { best, more } = suggestCategories(food, null, CATS)
    expect(best).toHaveLength(BEST_FIT_COUNT)
    expect(best.length + more.length).toBe(food.candidates.length)
  })

  it('skips a slug missing from the live tree instead of showing a blank', () => {
    const withoutTrucks = CATS.filter((cat) => cat.slug !== 'food-trucks')
    const { best, more } = suggestCategories(food, 'popups', withoutTrucks)
    expect([...best, ...more].map((cat) => cat.slug)).not.toContain('food-trucks')
    expect(best.every(Boolean)).toBe(true)
  })
})

describe('searchGuide', () => {
  it.each([
    ['barber', 'barber-shops'],
    ['Barbers', 'barber-shops'],
    ['lawyer', 'law-legal-services'],
    ['Food truck', 'food-trucks'],
    ['I make candles', 'candles-home-fragrance'],
    ['braids', 'braiding-extensions'],
    ['dentist', 'dentists'],
    ['dj', 'djs-live-music'],
    ['mobile mechanic', 'mobile-mechanic'],
    ['grocery store', 'grocery-markets'],
    ['credit union', 'banks-credit-unions'],
    ['bank', 'banks-credit-unions'],
    ['family farm', 'farms-farm-stands'],
  ])('"%s" finds %s first', (query, slug) => {
    expect(searchGuide(query, CATS)[0]?.slug).toBe(slug)
  })

  it('finds nothing for nonsense or a blank box', () => {
    expect(searchGuide('xyzzy', CATS)).toEqual([])
    expect(searchGuide('   ', CATS)).toEqual([])
    expect(searchGuide('my business', CATS)).toEqual([])
  })

  it('does not let a three-letter word match a longer one', () => {
    expect(searchGuide('apparel', CATS).map((cat) => cat.slug)).not.toContain(
      'app-mobile-development'
    )
  })

  it('caps the list', () => {
    expect(searchGuide('photo', CATS).length).toBeLessThanOrEqual(6)
  })
})

describe('suggestEntityType', () => {
  it.each([
    ['a barber people visit', 'barber-shops', 'beauty', 'visit', 'business'],
    [
      'a braider who comes to you',
      'braiding-extensions',
      'beauty',
      'come_to_them',
      'service_provider',
    ],
    ['a food truck', 'food-trucks', 'food', 'popups', 'vendor'],
    ['a restaurant', 'restaurants', 'food', 'visit', 'restaurant'],
    ['a caterer', 'catering-events-food', 'food', 'come_to_them', 'restaurant'],
    ['a lawyer', 'law-legal-services', 'money_law', 'visit', 'professional'],
    ['a tax preparer online', 'tax-services', 'money_law', 'online', 'professional'],
    ['a photographer', 'photography', 'creative', 'come_to_them', 'creative'],
    ['a candle maker online', 'candles-home-fragrance', 'make_sell', 'online', 'vendor'],
    ['a plumber', 'plumbing', 'home', 'come_to_them', 'service_provider'],
    ['a grocery store, not a restaurant', 'grocery-markets', 'food', 'visit', 'business'],
    ['a bank branch', 'banks-credit-unions', 'money_law', 'visit', 'professional'],
  ] as const)('%s', (_name, slug, answerId, where, type) => {
    expect(suggestEntityType(bySlug(slug), CATS, findAnswer(answerId), where)).toBe(type)
  })

  it('falls back to Business with nothing else to go on', () => {
    expect(suggestEntityType(bySlug('gift-shops'), CATS)).toBe('business')
  })
})

describe('buildGuidePick', () => {
  it('fills the form for a subcategory', () => {
    const cat = bySlug('barber-shops')
    const pick = buildGuidePick(cat, CATS, { answer: findAnswer('beauty'), where: 'visit' })
    expect(pick).toMatchObject({
      entityType: 'business',
      parentCategoryId: cat.parent_id,
      categoryId: cat.id,
      locationType: 'physical',
    })
    expect(pick.reason).toContain('"Hair, beauty and self-care"')
    expect(pick.reason).toContain('"A place they visit"')
  })

  it('leaves the subcategory open for a top-level pick that has children', () => {
    const parent = bySlug('food-dining')
    const pick = buildGuidePick(parent, CATS, { query: 'food' })
    expect(pick.parentCategoryId).toBe(parent.id)
    expect(pick.categoryId).toBe('')
    expect(pick.locationType).toBeNull()
    expect(pick.reason).toContain('You typed "food".')
  })

  it('explains a pop-up pick as a Vendor', () => {
    const pick = buildGuidePick(bySlug('food-trucks'), CATS, {
      answer: findAnswer('food'),
      where: 'popups',
    })
    expect(pick.entityType).toBe('vendor')
    expect(pick.locationType).toBe('traveling')
    expect(pick.reason).toContain('Vendor')
  })

  it('never uses an em dash in what the owner reads', () => {
    const copy = [
      ...GUIDE_ANSWERS.flatMap((a) => [a.label, a.hint]),
      ...GUIDE_WHERE.flatMap((w) => [w.label, w.hint]),
    ]
    for (const line of copy) expect(line).not.toMatch(/—/)
  })
})
