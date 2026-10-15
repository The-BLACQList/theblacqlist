// Simplicity explanations (founder, 2026-10-15). No Testing Library in this
// repo, so like review-form-listing-key.test.ts this pins the behaviour to
// source text. Real keyboard/touch behaviour needs a browser pass.
import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, it, expect } from 'vitest'

function read(rel: string): string {
  return readFileSync(path.join(process.cwd(), rel), 'utf8')
}

const REVIEWS = read('components/entity-page/EntityReviewsSection.tsx')
const BADGE = read('components/ui/status-badge.tsx')
const EXPLAINER = read('components/ui/TrustBadgeExplainer.tsx')

describe('signed-out empty reviews state', () => {
  it('shows the empty state only when there is no userId', () => {
    expect(REVIEWS).toMatch(/if \(userId\) return null/)
    expect(REVIEWS).toContain('No reviews yet. Been here?')
    expect(REVIEWS).toContain('Sign in to write the first one')
  })
  it('returns to the same listing through the existing next param', () => {
    expect(REVIEWS).toMatch(/\/sign-in\?next=\$\{encodeURIComponent\(returnTo\)\}/)
    expect(REVIEWS).toMatch(
      /buildEntityUrl\(entity\.entity_type, entity\.city\?\.slug, entity\.slug\)/
    )
  })
  it('keeps the reviews-heading id the section is labelled by', () => {
    expect(REVIEWS.match(/id="reviews-heading"/g)?.length).toBeGreaterThanOrEqual(3)
  })
})

describe('trust badge explainer', () => {
  it('is opt-in and only the listing hero enables it', () => {
    expect(BADGE).toMatch(/explain = false/)
    expect(read('components/entity-page/templates/TemplateHero.tsx')).toMatch(
      /<StatusBadge[^>]*\bexplain\b/
    )
    expect(read('components/entities/EntityCard.tsx')).not.toMatch(/StatusBadge[^>]*\bexplain\b/)
    expect(read('components/editorial/CollectionBusinessCard.tsx')).not.toMatch(
      /StatusBadge[^>]*\bexplain\b/
    )
  })
  it('has a meaning line for every tier', () => {
    for (const tier of ['unclaimed', 'claimed', 'verified', 'certified']) {
      expect(BADGE).toMatch(new RegExp(`${tier}:\\s+'`))
    }
  })
  it('is a real button with Escape, outside-click and a trust link', () => {
    expect(EXPLAINER).toMatch(/<button[\s\S]*type="button"/)
    expect(EXPLAINER).toMatch(/aria-expanded=\{open\}/)
    expect(EXPLAINER).toMatch(/e\.key === 'Escape'/)
    expect(EXPLAINER).toMatch(/pointerdown/)
    expect(EXPLAINER).toContain('href="/about/trust"')
    expect(EXPLAINER).toContain('How trust works')
  })
})
