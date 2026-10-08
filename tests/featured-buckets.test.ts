// =============================================================================
// lib/featured/buckets.ts: who competes with whom for the weekly Featured badge
// =============================================================================
// One winner per listing type each week [Decision - founder, 2026-10-05]. Each
// listing must land in exactly one bucket, or it could win twice in a week or
// never be counted. award_weekly_featured runs the same rules in SQL; these pin
// the TypeScript twin and the Monday the job scores.
// =============================================================================

import { describe, it, expect } from 'vitest'

import {
  BUCKET_LABELS,
  buildBucketRules,
  bucketLabel,
  lastFullWeekStart,
  resolveBucket,
} from '@/lib/featured/buckets'
import { VALID_ENTITY_TYPES } from '@/lib/constants/listing'
import type { CategoryNode } from '@/lib/listings/type-shortcuts'

const FOOD = 'food-0000'
const BAKERY = 'food-bake'
const LEGAL = 'legal-000'
const PHOTO = 'photo-000'
const RETAIL = 'retail-000'

const CATS: CategoryNode[] = [
  { id: FOOD, slug: 'food-dining', parent_id: null },
  { id: BAKERY, slug: 'bakeries', parent_id: FOOD },
  { id: LEGAL, slug: 'legal-financial', parent_id: null },
  { id: PHOTO, slug: 'photography-videography', parent_id: null },
  { id: RETAIL, slug: 'retail-gifts', parent_id: null },
]

const RULES = buildBucketRules(CATS)

const listing = (
  entity_type: string,
  category_id: string | null,
  location_type: string | null = 'physical'
) => ({ entity_type, category_id, location_type })

describe('buildBucketRules', () => {
  it('orders the mapped buckets and expands parents to children', () => {
    expect(RULES.map((r) => r.bucket)).toEqual([
      'restaurant',
      'professional',
      'creative',
      'service_provider',
    ])
    expect(RULES[0]?.category_ids.sort()).toEqual([BAKERY, FOOD].sort())
    expect(RULES[3]?.location_types).toContain('service_area')
  })
})

describe('creators (ticket 131)', () => {
  const CREATORS = 'cre-0000'
  const STREAM = 'cre-stream'
  const withCreators = buildBucketRules([
    ...CATS,
    { id: CREATORS, slug: 'creators-influencers', parent_id: null },
    { id: STREAM, slug: 'streamers', parent_id: CREATORS },
  ])

  it('checks Creators after Creatives and before Services', () => {
    expect(withCreators.map((r) => r.bucket)).toEqual([
      'restaurant',
      'professional',
      'creative',
      'creator',
      'service_provider',
    ])
  })

  it('a creator page competes with creators', () => {
    expect(resolveBucket(listing('creator', STREAM, 'virtual'), withCreators)).toBe('creator')
  })

  it('a business row in a Creators category is a creator, not an online service', () => {
    expect(resolveBucket(listing('business', STREAM, 'virtual'), withCreators)).toBe('creator')
  })
})

describe('resolveBucket', () => {
  it.each([
    ['a real restaurant row keeps its own type', listing('restaurant', RETAIL), 'restaurant'],
    ['a vendor keeps its own type', listing('vendor', FOOD), 'vendor'],
    ['an event keeps its own type', listing('event', null), 'event'],
    ['a business in a food child is a restaurant', listing('business', BAKERY), 'restaurant'],
    ['a business in legal is professional', listing('business', LEGAL), 'professional'],
    ['a business in photography is creative', listing('business', PHOTO), 'creative'],
    [
      'an unmapped business that comes to you is a service',
      listing('business', RETAIL, 'service_area'),
      'service_provider',
    ],
    ['category wins over location type', listing('business', FOOD, 'traveling'), 'restaurant'],
    ['an unmapped storefront is a business', listing('business', RETAIL), 'business'],
    ['no category and a storefront is a business', listing('business', null), 'business'],
    ['no location type is a business', listing('business', null, null), 'business'],
  ])('%s', (_name, row, bucket) => {
    expect(resolveBucket(row, RULES)).toBe(bucket)
  })

  it('leaves out types that sit out', () => {
    expect(resolveBucket(listing('job', null), RULES, ['job'])).toBeNull()
    expect(resolveBucket(listing('business', FOOD), RULES, ['job'])).toBe('restaurant')
  })
})

describe('labels', () => {
  it('has a plain name for every entity type', () => {
    for (const type of VALID_ENTITY_TYPES) expect(BUCKET_LABELS[type]).toBeTruthy()
    expect(bucketLabel('restaurant')).toBe('Restaurants')
    expect(bucketLabel('nonsense')).toBe('Businesses')
  })
})

describe('lastFullWeekStart', () => {
  it.each([
    // The cron fires Monday 09:00 UTC, 05:00 Eastern in October.
    ['Monday morning scores the week before', '2026-10-05T09:00:00Z', '2026-09-28'],
    ['Sunday night Eastern is still the week before', '2026-10-05T03:30:00Z', '2026-09-21'],
    ['mid-week', '2026-10-08T15:00:00Z', '2026-09-28'],
    ['Sunday afternoon', '2026-10-11T18:00:00Z', '2026-09-28'],
    // US clocks fall back on 1 Nov 2026; 09:00 UTC is 04:00 Eastern.
    ['across the fall-back weekend', '2026-11-02T09:00:00Z', '2026-10-26'],
    ['across a year end', '2027-01-04T09:00:00Z', '2026-12-28'],
  ])('%s', (_name, now, monday) => {
    expect(lastFullWeekStart(new Date(now))).toBe(monday)
  })
})
