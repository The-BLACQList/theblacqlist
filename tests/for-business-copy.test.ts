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
      'an average of 3.5 or better',
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
    expect(page).toMatch(/title: 'See Who Finds You',[\s\S]{0,160}plan: 'starter'/)
    expect(page).toMatch(/title: 'Reviews You Can Answer',[\s\S]{0,160}plan: 'starter'/)
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
    expect(canAccess('free', 'faqs')).toBe(false)
    expect(canAccess('starter', 'faqs')).toBe(true)
    expect(canAccess('free', 'social_links')).toBe(false)
    expect(canAccess('starter', 'social_links')).toBe(true)
    // Access works by rank, so these rows sit under the "Starter and Up" card.
    expect(canAccess('premium', 'listing_video')).toBe(true)
    expect(page).toMatch(
      /title: 'More on Your Page',\s*body: 'More photos, a video, common questions, and your social links\.',\s*plan: 'starter'/
    )
    // Free gets one photo, so the free row never types a number or says "photos" alone.
    expect(page).toMatch(
      /title: 'Your Story and Photos',[\s\S]{0,160}add a photo\.[\s\S]{0,80}plan: 'free'/
    )
  })

  // Ticket 206: the AI rows show only while their flag is on, and say AI writes them.
  it('gates every AI row on its flag and discloses AI', () => {
    expect(page).toMatch(
      /title: 'Start from a Draft',[\s\S]{0,200}written by AI[\s\S]{0,80}flag: 'onboarding'/
    )
    expect(page).toMatch(
      /title: 'Explain My Numbers',[\s\S]{0,160}AI writes it\.[\s\S]{0,60}flag: 'beta'/
    )
    expect(page).toMatch(
      /title: 'More Drafts for Your Page',[\s\S]{0,200}AI writes them[\s\S]{0,80}flag: 'beta'/
    )
    expect(page).toContain("isFeatureEnabled('aiOnboarding')")
    expect(page).toContain("isFeatureEnabled('aiBeta')")
    expect(page).not.toMatch(/AI-powered/i)
  })

  // The free analytics claim came out in the workshop: analytics is Starter and up.
  it('never says Free owners see how people find them', () => {
    expect(page).not.toMatch(/see how people find you/i)
    expect(page).not.toMatch(/in a few minutes/)
  })

  // One owner door: every sitewide owner link lands on #start, so the id is printed once.
  it('prints the #start id exactly once', () => {
    expect(page.match(/id="start"/g)).toHaveLength(1)
  })

  it('uses the shared plans component with no Most Popular flag', () => {
    expect(page).toContain('<PricingPlans')
    expect(page).toContain('showFeatured={false}')
    expect(page).not.toMatch(/most popular/i)
    expect(page).toContain("export const dynamic = 'force-dynamic'")
  })

  // Ticket 206: one card per sample page, each pointing at a route that exists.
  it('links every sample page, and says the business is made up', async () => {
    const { EXAMPLE_VARIANTS } = await import('@/lib/example/fixtures')
    for (const variant of EXAMPLE_VARIANTS) {
      expect(page).toContain(`variant: '${variant}'`)
    }
    expect(page).toContain('href={`/example/${sample.variant}`}')
    expect(page).toContain('The business on these pages is made up')
  })

  it('never types a price into the page', () => {
    expect(page).not.toMatch(/\$\d/)
  })
})
