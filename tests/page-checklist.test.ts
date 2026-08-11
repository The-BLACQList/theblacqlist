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
