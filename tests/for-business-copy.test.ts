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

import { canAccess, photoLimit } from '@/lib/stripe/features'

const page = readFileSync(path.join(process.cwd(), 'app/(public)/for-business/page.tsx'), 'utf8')

// Ticket 276: the trust page said every claimed page can reply to reviews.
describe('/about/trust copy', () => {
  const trust = readFileSync(path.join(process.cwd(), 'app/(public)/about/trust/page.tsx'), 'utf8')

  it('says replying to reviews needs Starter and up, matching features.ts', () => {
    expect(canAccess('free', 'review_response')).toBe(false)
    expect(canAccess('starter', 'review_response')).toBe(true)
    expect(trust).toContain('On Starter and up, they can also reply to reviews.')
    expect(trust).not.toContain('respond to reviews')
  })
})

// Ticket 277: the approval email goes to every plan and the My Account claim box
// says claiming is free, so neither may promise Starter features.
describe('free owner promises', () => {
  const email = readFileSync(
    path.join(process.cwd(), 'lib/email/templates/entity-approved.tsx'),
    'utf8'
  )
  const account = readFileSync(path.join(process.cwd(), 'app/account/(overview)/page.tsx'), 'utf8')

  it('keeps review replies and analytics out of the approval email', () => {
    expect(canAccess('free', 'review_response')).toBe(false)
    expect(photoLimit('free')).toBeGreaterThan(0)
    expect(email).toContain('You can update your details and add photos any time from')
    expect(email).not.toMatch(/(respond|reply) to reviews|answer reviews/i)
  })

  it('keeps review replies and analytics out of the My Account claim box', () => {
    expect(canAccess('free', 'review_response')).toBe(false)
    expect(canAccess('free', 'analytics')).toBe(false)
    expect(account).toContain('Keep your hours, story and photos right.')
    expect(account).not.toMatch(/answer reviews|see who finds you/i)
  })
})

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
    // Access works by rank, so these rows carry the "Starter and Up" label.
    expect(canAccess('premium', 'listing_video')).toBe(true)
    expect(page).toMatch(
      /title: 'More on Your Page',\s*body: 'Up to 10 photos, a video, common questions, and your social links\.',\s*plan: 'starter'/
    )
    // Ticket 239: Free gets 3 photos, Starter 10, and the rows say so.
    expect(photoLimit('free')).toBe(3)
    expect(photoLimit('starter')).toBe(10)
    expect(page).toMatch(
      /title: 'Your Story and Photos',[\s\S]{0,160}in your own words, and up to 3 photos\.[\s\S]{0,80}plan: 'free'/
    )
  })

  it('marks the full page layout Starter and up, matching features.ts', () => {
    expect(canAccess('free', 'chapters_layout')).toBe(false)
    expect(canAccess('starter', 'chapters_layout')).toBe(true)
    expect(page).toMatch(/title: 'The Full Page Layout',[\s\S]{0,200}chapters\.',\s*plan: 'starter'/)
  })

  // Ticket 244: the logo pin is Starter and up. Ticket 276: the row says only
  // that the plan doesn't change the order (sponsored and featured pages do).
  it('marks the logo map pin Starter and up, matching features.ts', () => {
    expect(canAccess('free', 'map_logo_pin')).toBe(false)
    expect(canAccess('starter', 'map_logo_pin')).toBe(true)
    expect(page).toMatch(
      /title: 'Your Logo on the Map',[\s\S]{0,120}Your logo as your map pin[\s\S]{0,160}Your plan doesn't change where you sit on the map\.\",\s*plan: 'starter'/
    )
  })

  // Ticket 206: AI shows only while its flag is on. Ticket 240 (founder
  // 2026-11-21): one row, "AI Help for What Matters", whose title is the
  // disclosure. Free to Start when the free add-business help is on too;
  // Starter and Up otherwise. Never "drafts". No Cue: the dashboard tools
  // aren't called Cue, and Marketing keeps Cue in the supporter lane.
  it('shows one AI row, gated on its flags, and discloses AI', () => {
    expect(page.match(/title: '[^']*\bAI\b[^']*'/g)).toEqual(["title: 'AI Help for What Matters'"])
    expect(page).toContain(
      'Your words, sharpened. Your numbers, explained. AI helps you write what customers and search engines read first, and explains your numbers with one thing to try next.'
    )
    // The read explains numbers and gives one thing to try; it can't know
    // causes, so no "what's working". Free covers only the add-business
    // writing help, so the Free to Start line says number reads are Starter
    // and up (Marketing claim check, 2026-11-21).
    expect(page).not.toMatch(/what's working/)
    expect(page).toMatch(/const rows: Row\[\] = aiBetaOn\s*\?/)
    expect(page).toMatch(
      /aiOnboardingOn\s*\?[\s\S]{0,120}plan: 'freeToStart',[\s\S]{0,40}note: 'Free when you add your business\. Starter and up explains your numbers\.'/
    )
    expect(page).toMatch(
      /plan: 'starter',\s*note: 'Your plan sets how often it helps every 30 days\.'/
    )
    expect(page).toContain("freeToStart: 'Free to Start'")
    // Between the Free rows and the Starter and Up rows (founder 2026-11-21).
    expect(page).toMatch(
      /\.\.\.ROWS\.filter\(\(r\) => r\.plan === 'free'\),\s*aiOnboardingOn[\s\S]{0,400}\.\.\.ROWS\.filter\(\(r\) => r\.plan !== 'free'\),/
    )
    // Strings only (comments may name what is left out, and why).
    const strings = page.match(/'[^'\n]*'|"[^"\n]*"/g) ?? []
    expect(strings.filter((x) => /AI writes|\bCue\b|\bdrafts?\b/i.test(x))).toEqual([])
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
