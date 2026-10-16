// =============================================================================
// Card pills: category chip in, Black-Owned and Unclaimed out (2026-10-16)
// =============================================================================
// Founder decision: every listing is assumed Black-owned, so the Black-Owned
// pill "rings the alarm" without telling a shopper anything. Ally shows only on
// the rare non-Black-owned business. The pill slot goes to a category chip that
// filters /discover instead.
//
// vitest runs in node with no jsdom (vitest.config.ts), so the render checks
// below read source text, the same instrument as tests/save-controls.test.ts.
// =============================================================================

import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { categoryFilterHref } from '@/lib/listings/url'
import { OWNERSHIP_LABEL_MAP } from '@/components/discovery/facetConstants'

function source(relPath: string): string {
  return readFileSync(path.resolve(process.cwd(), relPath), 'utf8')
}

describe('categoryFilterHref', () => {
  it('points at the discover page filtered to the category', () => {
    expect(categoryFilterHref({ slug: 'coffee-tea' })).toBe('/discover?category=coffee-tea')
  })

  it('encodes the slug', () => {
    expect(categoryFilterHref({ slug: 'a b' })).toBe('/discover?category=a%20b')
  })

  it('returns null for the `general` fallback and a missing slug', () => {
    expect(categoryFilterHref({ slug: 'general' })).toBeNull()
    expect(categoryFilterHref({ slug: '' })).toBeNull()
    expect(categoryFilterHref({ slug: null })).toBeNull()
    expect(categoryFilterHref(null)).toBeNull()
    expect(categoryFilterHref(undefined)).toBeNull()
  })
})

describe('OwnershipBadge', () => {
  const badge = source('components/ui/ownership-badge.tsx')

  it('renders nothing unless the label is ally', () => {
    expect(badge).toMatch(/if \(label !== 'ally'\) return null/)
  })
})

describe('EntityCard pill row', () => {
  const card = source('components/entities/EntityCard.tsx')

  it('links a category chip to the discover filter', () => {
    expect(card).toContain('categoryFilterHref(entity.category)')
    expect(card).toMatch(/aria-label=\{`More in \$\{entity\.category\.name\}`\}/)
  })

  it('shows the trust badge only when earned', () => {
    expect(card).toMatch(/entity\.trust_tier !== 'unclaimed' && \(\s*<StatusBadge/)
  })

  it('keeps a type pill for events and jobs only', () => {
    const map = card.slice(card.indexOf('const TYPE_PILL_LABELS'), card.indexOf('}', card.indexOf('const TYPE_PILL_LABELS')))
    expect(map).toContain("event: 'Event'")
    expect(map).toContain("job: 'Job'")
    expect(map).not.toContain('Business')
  })

  it('never prints the Black-Owned label itself', () => {
    expect(card).not.toContain("'Black-Owned'")
    expect(card).not.toMatch(/ownership_label === 'black_owned'/)
  })
})

describe('TemplateHero pill row', () => {
  const hero = source('components/entity-page/templates/TemplateHero.tsx')

  it('uses the same rules as the card', () => {
    expect(hero).toContain('categoryFilterHref(entity.category)')
    expect(hero).toMatch(/entity\.trust_tier !== 'unclaimed' && \(\s*<StatusBadge/)
    expect(hero).not.toContain("business: 'Business'")
  })
})

describe('Trust panel and other label surfaces', () => {
  it('names Ally only in the trust panel', () => {
    const panel = source('components/entity-page/templates/TemplateTrustPanel.tsx')
    expect(panel).not.toContain('Ownership label:')
    expect(panel).toMatch(/entity\.ownership_label === 'ally' &&/)
  })

  it('drops Black-Owned from the map popup', () => {
    expect(source('components/map/popupContent.ts')).not.toContain("'Black-Owned'")
  })
})

describe('Ownership filter', () => {
  it('is gone from the sidebar', () => {
    expect(source('components/discovery/FacetSidebar.tsx')).not.toContain('title="Ownership"')
  })

  it('still labels an old ?ownership= chip so it can be removed', () => {
    expect(OWNERSHIP_LABEL_MAP).toEqual({ black_owned: 'Black-Owned', ally: 'Ally' })
  })
})
