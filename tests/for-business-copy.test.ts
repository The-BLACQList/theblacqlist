// =============================================================================
// Ticket 115: /for-business copy checks
// =============================================================================
// The page states plan gates and the Certified rule in prose, so it can drift
// from lib/stripe/features.ts and moderation-policy.md. These checks pin the
// facts the spec calls out.
// =============================================================================

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

import { canAccess } from '@/lib/stripe/features'

const page = readFileSync(path.join(process.cwd(), 'app/(public)/for-business/page.tsx'), 'utf8')

describe('/for-business copy', () => {
  it('has no em dashes anywhere in the file', () => {
    expect(page).not.toContain('—')
  })

  it('states every Certified criterion', () => {
    for (const fact of [
      '5 or more reviews',
      '3.5 average',
      '90 days since the claim',
      'complete details',
    ]) {
      expect(page).toContain(fact)
    }
    expect(page).toContain('Nobody can buy it.')
  })

  it('marks analytics and review replies as Starter and up, matching features.ts', () => {
    expect(canAccess('free', 'analytics')).toBe(false)
    expect(canAccess('starter', 'analytics')).toBe(true)
    expect(canAccess('free', 'review_response')).toBe(false)
    expect(canAccess('starter', 'review_response')).toBe(true)
    expect(page).toMatch(/title: 'See who finds you',[\s\S]{0,120}starter: true/)
    expect(page).toMatch(/title: 'Reviews you can answer',[\s\S]{0,120}starter: true/)
  })

  // Verified is free for every claimed owner (founder, 2026-10-03). The
  // `verified_badge` gate exists in features.ts but nothing reads it.
  it('says Verified is free, not a Starter perk', () => {
    expect(page).toContain('we checked it by hand. Free for every owner.')
    expect(page).not.toMatch(/Available on Starter/)
  })

  it('names only Starter extras that features.ts actually gates', () => {
    expect(canAccess('free', 'listing_video')).toBe(false)
    expect(canAccess('starter', 'listing_video')).toBe(true)
    expect(canAccess('free', 'social_links')).toBe(false)
    expect(page).toContain('Add more photos, a video, and common questions on Starter.')
    expect(page).toContain("title: 'Hours, website, and contact'")
  })

  it('uses the shared plans component with no Most Popular flag', () => {
    expect(page).toContain('<PricingPlans')
    expect(page).toContain('showFeatured={false}')
    expect(page).not.toMatch(/most popular/i)
    expect(page).toContain("export const dynamic = 'force-dynamic'")
  })

  it('never types a price into the page', () => {
    expect(page).not.toMatch(/\$\d/)
  })
})
