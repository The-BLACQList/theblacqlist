// =============================================================================
// Plan copy matches what each plan delivers (plan-features audit, 2026-10)
// =============================================================================
// PLANS feeds /pricing, /for-business and /dashboard/upgrade. Starter is on
// sale, so every Starter line has to be backed by a gate or a limit in
// lib/stripe/features.ts. These checks pin the numbers in the copy to the
// numbers the code enforces, and keep out the lines the audit cut.
// See docs/blacqlist/design/plan-features-audit-2026-10.md.
// =============================================================================

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

import { PLANS, getPlanMeta } from '@/lib/stripe/plans'
import {
  attributeLimit,
  canAccess,
  descriptionCharLimit,
  eventLimit,
  faqLimit,
  jobLimit,
  locationLimit,
  photoLimit,
  productLimit,
  teamMemberLimit,
  videoLimit,
} from '@/lib/stripe/features'

const allLines = PLANS.flatMap((p) => [p.tagline, ...p.features])

describe('PLANS copy', () => {
  it('has no em dashes', () => {
    for (const line of allLines) expect(line).not.toContain('—')
  })

  it('drops the lines the audit cut', () => {
    for (const line of allLines) {
      expect(line).not.toMatch(/\$299/)
      expect(line).not.toMatch(/exclusiv/i)
      expect(line).not.toMatch(/powered by/i)
      expect(line).not.toMatch(/\bAI\b/)
      expect(line).not.toMatch(/homepage/i)
    }
  })

  it('has no tagline that promises owning or locking a category', () => {
    for (const plan of PLANS) expect(plan.tagline).not.toMatch(/own the|category/i)
  })

  it('does not sell Verified: it is on Free', () => {
    expect(getPlanMeta('free').features).toContain('Claim it and get Verified, free')
    for (const slug of ['starter', 'growth', 'premium'] as const) {
      for (const line of getPlanMeta(slug).features) expect(line).not.toMatch(/verified/i)
    }
  })
})

describe('Free copy matches the Free limits', () => {
  const free = getPlanMeta('free').features

  it('states the enforced numbers', () => {
    expect(photoLimit('free')).toBe(1)
    expect(free).toContain('1 photo')
    expect(descriptionCharLimit('free')).toBe(300)
    expect(free).toContain('A short description (up to 300 characters)')
    expect(attributeLimit('free')).toBe(3)
    expect(free.some((l) => l.startsWith('Up to 3 details customers filter by'))).toBe(true)
  })
})

describe('Starter copy matches the Starter gates and limits', () => {
  const starter = getPlanMeta('starter').features

  it('every Starter extra is gated off Free and open on Starter', () => {
    for (const feature of [
      'listing_video',
      'faqs',
      'social_links',
      'review_response',
      'analytics',
    ] as const) {
      expect(canAccess('free', feature)).toBe(false)
      expect(canAccess('starter', feature)).toBe(true)
    }
  })

  it('states the enforced numbers', () => {
    expect(photoLimit('starter')).toBe(10)
    expect(starter).toContain('Up to 10 photos')
    expect(videoLimit('starter')).toBe(1)
    expect(starter).toContain('A video on your page, your own upload or a link')
    expect(descriptionCharLimit('starter')).toBeNull()
    expect(starter).toContain('Your full story, with no length limit')
    expect(attributeLimit('starter')).toBe(10)
    expect(starter).toContain('Up to 10 details customers filter by')
    expect(faqLimit('starter')).toBe(5)
    expect(starter).toContain('A common questions section (up to 5)')
  })
})

// Growth and Premium are not for sale and their bullets do not render, but the
// lists still have to be true for the day a tier opens.
describe('Growth and Premium lists match their limits', () => {
  it('Growth', () => {
    const growth = getPlanMeta('growth').features
    expect(photoLimit('growth')).toBe(25)
    expect(growth).toContain('Up to 25 photos')
    expect(productLimit('growth')).toBe(25)
    expect(eventLimit('growth')).toBe(3)
    expect(jobLimit('growth')).toBe(1)
    expect(teamMemberLimit('growth')).toBe(5)
    expect(growth).toContain('Up to 5 team members')
  })

  it('Premium', () => {
    const premium = getPlanMeta('premium').features
    expect(photoLimit('premium')).toBe(50)
    expect(premium).toContain('Up to 50 photos')
    expect(productLimit('premium')).toBeNull()
    expect(eventLimit('premium')).toBeNull()
    expect(jobLimit('premium')).toBe(3)
    expect(locationLimit('premium')).toBe(3)
    expect(premium).toContain('Up to 3 locations on one account')
  })
})

// /for-sponsors printed $299 to $999 and $49 to $99 for two add-ons nobody can
// buy. /pricing already dropped them; this keeps the two pages in step.
describe('/for-sponsors prints no price for an add-on that is not on sale', () => {
  const page = readFileSync(path.join(process.cwd(), 'app/(public)/for-sponsors/page.tsx'), 'utf8')
  const rendered = page.replace(/\{\/\*[\s\S]*?\*\/\}/g, '')

  it('shows no dollar amounts', () => {
    expect(rendered).not.toMatch(/\$\d/)
  })

  it('labels both add-ons Coming Soon', () => {
    expect(rendered.match(/Coming Soon/g)?.length).toBe(2)
  })

  it('sends the waitlist button to the form that records interest', () => {
    expect(rendered).toContain('href="/pricing#pricing-waitlist"')
    expect(rendered).not.toContain('href="/sign-up"')
  })
})
