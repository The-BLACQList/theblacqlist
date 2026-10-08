import { describe, expect, it } from 'vitest'

import { computePageChecklist } from '@/lib/ai/checklist'

// Annotated, not inferred: without this the fields widen to the literal type
// `null`, and `Partial<typeof EMPTY_LISTING>` then rejects every string path.
type ChecklistListing = {
  tagline: string | null
  meta_title: string | null
  meta_description: string | null
  cover_image_path: string | null
}

const EMPTY_LISTING: ChecklistListing = {
  tagline: null,
  meta_title: null,
  meta_description: null,
  cover_image_path: null,
}

function coverItem(listing: Partial<ChecklistListing>, mediaCount = 0) {
  const result = computePageChecklist(
    { ...EMPTY_LISTING, ...listing },
    null,
    mediaCount,
    0,
    0
  )
  const item = result.items.find((i) => i.id === 'cover')
  if (!item) throw new Error('cover item missing from the checklist')
  return item
}

describe('page checklist — cover image', () => {
  // The whole owner-upload flywheel leans on this one row telling the truth.
  // It previously passed on `mediaCount >= 2`, so a listing with two gallery
  // photos and no cover scored the point and the owner was never prompted.
  it('does not pass on gallery photos alone', () => {
    expect(coverItem({}, 5).passed).toBe(false)
  })

  it('passes when cover_image_path is set, even with no gallery photos', () => {
    expect(coverItem({ cover_image_path: 'listing-id/cover.jpg' }, 0).passed).toBe(true)
  })

  it('treats a whitespace-only path as no cover', () => {
    expect(coverItem({ cover_image_path: '   ' }, 0).passed).toBe(false)
  })

  it('states the minimum size in the hint so the spec reaches the owner', () => {
    expect(coverItem({}).hint).toContain('1200×800px')
  })
})

describe('page checklist — scoring', () => {
  it('scores zero on a completely empty listing', () => {
    const { score } = computePageChecklist(EMPTY_LISTING, null, 0, 0, 0)
    expect(score).toBe(0)
  })

  it('awards the cover weight when a cover is set', () => {
    const before = computePageChecklist(EMPTY_LISTING, null, 0, 0, 0)
    const after = computePageChecklist(
      { ...EMPTY_LISTING, cover_image_path: 'x/cover.jpg' },
      null,
      0,
      0,
      0
    )
    expect(after.score - before.score).toBe(coverItem({}).weight)
    expect(after.maxScore).toBe(before.maxScore)
  })
})

const FULL_DETAILS = {
  description: 'A'.repeat(120),
  phone: '555-0100',
  website_url: null,
  social_instagram: null,
  social_facebook: null,
  social_tiktok: null,
  social_youtube: null,
  social_twitter: null,
  social_linkedin: null,
  cta_type: 'call',
}

const FULL_LISTING: ChecklistListing = {
  tagline: 'Fresh bread daily',
  meta_title: 'Bakery in Atlanta',
  meta_description: 'Fresh bread daily in Atlanta.',
  cover_image_path: 'x/cover.jpg',
}

describe('page checklist — plan aware', () => {
  it('lets a Free page reach 100% with one photo and no social links', () => {
    const result = computePageChecklist(FULL_LISTING, FULL_DETAILS, 1, 1, 1, 'free')
    expect(result.percent).toBe(100)
    expect(result.items.map((i) => i.id)).not.toContain('gallery')
    expect(result.items.map((i) => i.id)).not.toContain('social')
  })

  it('keeps gallery and social for Starter', () => {
    const result = computePageChecklist(FULL_LISTING, FULL_DETAILS, 1, 1, 1, 'starter')
    expect(result.items.map((i) => i.id)).toEqual(expect.arrayContaining(['gallery', 'social']))
    expect(result.percent).toBeLessThan(100)
  })

  it('scores every item when no tier is given', () => {
    const withTier = computePageChecklist(EMPTY_LISTING, null, 0, 0, 0, 'premium')
    const without = computePageChecklist(EMPTY_LISTING, null, 0, 0, 0)
    expect(without.items).toHaveLength(withTier.items.length)
    expect(without.maxScore).toBe(withTier.maxScore)
  })

  it('reports percent as a whole number', () => {
    const { percent } = computePageChecklist(
      { ...EMPTY_LISTING, tagline: 'x' },
      null,
      0,
      0,
      0,
      'free'
    )
    expect(Number.isInteger(percent)).toBe(true)
    expect(percent).toBeGreaterThan(0)
  })
})

// Ticket 132: a creator page drops hours and phone/website, and adds a niche
// and a sample post or video.
describe('page checklist — creator pages', () => {
  const facts = { nicheCount: 0, hasSample: false }
  const ids = (creator: typeof facts | null) =>
    computePageChecklist(EMPTY_LISTING, null, 0, 0, 0, undefined, creator).items.map((i) => i.id)

  it('drops contact and hours and adds niche and sample', () => {
    const list = ids(facts)
    expect(list).not.toContain('contact')
    expect(list).not.toContain('hours')
    expect(list).toContain('niche')
    expect(list).toContain('sample')
  })

  it('leaves the business checklist unchanged without creator facts', () => {
    const list = ids(null)
    expect(list).toContain('contact')
    expect(list).toContain('hours')
    expect(list).not.toContain('niche')
  })

  it('passes niche and sample from the facts', () => {
    const items = computePageChecklist(EMPTY_LISTING, null, 0, 0, 0, undefined, {
      nicheCount: 2,
      hasSample: true,
    }).items
    expect(items.find((i) => i.id === 'niche')?.passed).toBe(true)
    expect(items.find((i) => i.id === 'sample')?.passed).toBe(true)
  })

  it('words the description and photo for a person', () => {
    const items = computePageChecklist(EMPTY_LISTING, null, 0, 0, 0, undefined, facts).items
    expect(items.find((i) => i.id === 'description')?.label).toBe('About you (100+ characters)')
    expect(items.find((i) => i.id === 'logo')?.label).toBe('Profile photo uploaded')
  })
})
