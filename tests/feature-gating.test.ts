import { describe, it, expect } from 'vitest'
import {
  canAccess,
  photoLimit,
  aiQuota,
  limitsFor,
  isAtLimit,
  videoLimit,
  faqLimit,
  productLimit,
  eventLimit,
  locationLimit,
  analyticsHistoryDays,
  PHOTO_LIMITS,
  TIER_LIMITS,
  type GatedFeature,
} from '@/lib/stripe/features'

const TIERS = ['free', 'starter', 'growth', 'premium'] as const

// Every gated feature, so a new one added to the union without a test here still gets counted by the
// monotonicity check below.
const ALL_FEATURES: GatedFeature[] = [
  'analytics',
  'ai_suggestions',
  'review_response',
  'verified_badge',
  'listing_video',
  'faqs',
  'social_links',
  'hide_platform_badge',
  'priority_placement',
  'review_criteria',
  'storefront',
  'service_menu_pricing',
  'events',
  'team_members',
  'featured_collection',
  'editorial_eligibility',
  'analytics_advanced',
  'priority_support',
  'coupons',
  'booking_requests',
  'multi_location',
  'homepage_featured',
  'category_exclusivity',
  'spend_impact_panel',
  'sonnet_agents',
  'dedicated_support',
]

// Adjacent tier pairs, low → high. Avoids numeric indexing so the checks stay type-safe.
const TIER_STEPS = [
  ['free', 'starter'],
  ['starter', 'growth'],
  ['growth', 'premium'],
] as const

describe('photoLimit', () => {
  it('caps free 1, starter 10, growth 25, premium 50', () => {
    expect(photoLimit('free')).toBe(1)
    expect(photoLimit('starter')).toBe(10)
    expect(photoLimit('growth')).toBe(25)
    expect(photoLimit('premium')).toBe(50)
    expect(PHOTO_LIMITS.premium).toBe(50)
  })

  it('treats null / unknown tiers as free', () => {
    expect(photoLimit(null)).toBe(1)
    expect(photoLimit('bogus')).toBe(1)
  })

  it('keeps a hard cap at every tier — photos are the storage cost tail', () => {
    for (const tier of TIERS) {
      expect(TIER_LIMITS[tier].photos).not.toBeNull()
    }
  })
})

describe('canAccess — the tier ladder', () => {
  it('gates credibility features at Starter+', () => {
    const starterFeatures: GatedFeature[] = [
      'analytics',
      'ai_suggestions',
      'review_response',
      'verified_badge',
      'listing_video',
      'faqs',
      'social_links',
      'hide_platform_badge',
    ]
    for (const feature of starterFeatures) {
      expect(canAccess('free', feature)).toBe(false)
      expect(canAccess('starter', feature)).toBe(true)
      expect(canAccess('growth', feature)).toBe(true)
      expect(canAccess('premium', feature)).toBe(true)
    }
  })

  it('gates merchandising features at Growth+', () => {
    const growthFeatures: GatedFeature[] = [
      'priority_placement',
      'review_criteria',
      'storefront',
      'service_menu_pricing',
      'events',
      'team_members',
      'featured_collection',
      'editorial_eligibility',
      'analytics_advanced',
      'priority_support',
    ]
    for (const feature of growthFeatures) {
      expect(canAccess('free', feature)).toBe(false)
      expect(canAccess('starter', feature)).toBe(false)
      expect(canAccess('growth', feature)).toBe(true)
      expect(canAccess('premium', feature)).toBe(true)
    }
  })

  it('gates growth-engine features at Premium only', () => {
    const premiumFeatures: GatedFeature[] = [
      'coupons',
      'booking_requests',
      'multi_location',
      'homepage_featured',
      'category_exclusivity',
      'spend_impact_panel',
      'sonnet_agents',
      'dedicated_support',
    ]
    for (const feature of premiumFeatures) {
      expect(canAccess('free', feature)).toBe(false)
      expect(canAccess('starter', feature)).toBe(false)
      expect(canAccess('growth', feature)).toBe(false)
      expect(canAccess('premium', feature)).toBe(true)
    }
  })

  it('defaults unknown / null tiers to free (no access)', () => {
    expect(canAccess(null, 'analytics')).toBe(false)
    expect(canAccess('bogus', 'review_response')).toBe(false)
    expect(canAccess('bogus', 'coupons')).toBe(false)
  })
})

// The ladder only works if each paid tier is a visible step up. These assertions are what stop a
// future edit from quietly flattening it back into "$19 with two decoy prices".
describe('the ladder is monotonic and actually differentiated', () => {
  it('every paid tier unlocks strictly more features than the one below it', () => {
    const unlocked = (tier: string) => ALL_FEATURES.filter((f) => canAccess(tier, f)).length

    expect(unlocked('free')).toBe(0) // free unlocks nothing gated
    for (const [lower, higher] of TIER_STEPS) {
      expect(unlocked(higher)).toBeGreaterThan(unlocked(lower))
    }
  })

  it('limits never regress as tier increases', () => {
    const rank = (v: number | null) => (v === null ? Number.POSITIVE_INFINITY : v)
    const numericKeys = [
      'photos',
      'videos',
      'faqs',
      'attributes',
      'products',
      'events',
      'teamMembers',
      'locations',
      'aiGenerationsPerMonth',
    ] as const

    for (const key of numericKeys) {
      for (const [lower, higher] of TIER_STEPS) {
        expect(rank(TIER_LIMITS[higher][key])).toBeGreaterThanOrEqual(rank(TIER_LIMITS[lower][key]))
      }
    }
  })

  it('gives Growth and Premium a reason to exist beyond photo count', () => {
    // Growth must differ from Starter on something other than photos.
    expect(productLimit('growth')).toBeGreaterThan(productLimit('starter') ?? 0)
    expect(eventLimit('growth')).toBeGreaterThan(eventLimit('starter') ?? 0)
    expect(canAccess('growth', 'storefront')).toBe(true)
    expect(canAccess('starter', 'storefront')).toBe(false)

    // Premium must differ from Growth on something other than photos.
    expect(locationLimit('premium')).toBeGreaterThan(locationLimit('growth') ?? 0)
    expect(canAccess('premium', 'booking_requests')).toBe(true)
    expect(canAccess('growth', 'booking_requests')).toBe(false)
  })
})

describe('aiQuota — cost guardrail and pricing lever', () => {
  it('scales with tier and is never unlimited', () => {
    expect(aiQuota('free')).toBe(0)
    expect(aiQuota('starter')).toBe(10)
    expect(aiQuota('growth')).toBe(100)
    expect(aiQuota('premium')).toBe(500)
  })

  it('is bounded at every tier — an unlimited quota is an unbounded LLM bill', () => {
    for (const tier of TIERS) {
      expect(TIER_LIMITS[tier].aiGenerationsPerMonth).not.toBeNull()
    }
  })

  it('gives free tier no AI at all, matching the ai_suggestions gate', () => {
    expect(aiQuota('free')).toBe(0)
    expect(canAccess('free', 'ai_suggestions')).toBe(false)
  })
})

describe('other limit accessors', () => {
  it('resolves per tier with null meaning unlimited', () => {
    expect(videoLimit('free')).toBe(0)
    expect(videoLimit('starter')).toBe(1)
    expect(videoLimit('premium')).toBeNull()

    expect(faqLimit('starter')).toBe(5)
    expect(faqLimit('growth')).toBeNull()

    expect(analyticsHistoryDays('free')).toBe(0)
    expect(analyticsHistoryDays('starter')).toBe(30)
    expect(analyticsHistoryDays('growth')).toBe(365)
  })

  it('falls back to free limits for unknown tiers', () => {
    expect(limitsFor('bogus')).toEqual(TIER_LIMITS.free)
    expect(limitsFor(null)).toEqual(TIER_LIMITS.free)
  })
})

describe('isAtLimit', () => {
  it('is true once count reaches the cap', () => {
    expect(isAtLimit('starter', 'photos', 9)).toBe(false)
    expect(isAtLimit('starter', 'photos', 10)).toBe(true)
    expect(isAtLimit('starter', 'photos', 11)).toBe(true)
  })

  it('is never true when the limit is unlimited', () => {
    expect(isAtLimit('premium', 'videos', 9999)).toBe(false)
  })

  it('blocks immediately on a zero limit', () => {
    expect(isAtLimit('free', 'videos', 0)).toBe(true)
    expect(isAtLimit('starter', 'products', 0)).toBe(true)
  })
})
