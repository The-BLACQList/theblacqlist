import { describe, it, expect } from 'vitest'
import { canAccess, photoLimit, PHOTO_LIMITS } from '@/lib/stripe/features'

describe('photoLimit', () => {
  it('caps free 1, starter 10, growth 20, premium 50', () => {
    expect(photoLimit('free')).toBe(1)
    expect(photoLimit('starter')).toBe(10)
    expect(photoLimit('growth')).toBe(20)
    expect(photoLimit('premium')).toBe(50)
    expect(PHOTO_LIMITS.premium).toBe(50)
  })

  it('treats null / unknown tiers as free', () => {
    expect(photoLimit(null)).toBe(1)
    expect(photoLimit('bogus')).toBe(1)
  })
})

describe('canAccess', () => {
  it('gates every built feature to Starter+ (any paid tier)', () => {
    for (const feature of ['analytics', 'ai_suggestions', 'priority_placement', 'review_response'] as const) {
      expect(canAccess('free', feature)).toBe(false)
      expect(canAccess('starter', feature)).toBe(true)
      expect(canAccess('growth', feature)).toBe(true)
      expect(canAccess('premium', feature)).toBe(true)
    }
  })

  it('defaults unknown / null tiers to free (no access)', () => {
    expect(canAccess(null, 'analytics')).toBe(false)
    expect(canAccess('bogus', 'review_response')).toBe(false)
  })
})
