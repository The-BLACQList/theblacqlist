// =============================================================================
// Ticket 170: subcategory suggestions for listings filed only under a group
// =============================================================================
// The pure rule in lib/listings/subcategorySuggest.ts. The scripts that read
// and write the database are run by hand against staging.
// =============================================================================

import { describe, expect, it } from 'vitest'

import { suggestSubcategory } from '@/lib/listings/subcategorySuggest'
import type { AssistCategory } from '@/lib/search/assist'

// Real slugs and parents from supabase/seed.sql, so the real related words apply.
const PRO = 'c0000001-0000-0000-0000-000000000005'
const EVENTS = 'c0000001-0000-0000-0000-000000000008'

const CATEGORIES: AssistCategory[] = [
  { id: PRO, name: 'Professional Services', slug: 'professional-services', parentId: null },
  { id: 'law', name: 'Law & Legal Services', slug: 'law-legal-services', parentId: PRO },
  { id: 'tax', name: 'Accounting & Tax Preparation', slug: 'accounting-tax-preparation', parentId: PRO },
  { id: 'notary', name: 'Notary & Document Services', slug: 'notary-document-services', parentId: PRO },
  { id: 'ins', name: 'Insurance', slug: 'insurance', parentId: PRO },
  { id: EVENTS, name: 'Events & Entertainment', slug: 'events-entertainment', parentId: null },
  { id: 'plan', name: 'Event Planning', slug: 'event-planning', parentId: EVENTS },
  { id: 'supplies', name: 'Party Supplies & Rentals', slug: 'party-supplies-rentals', parentId: EVENTS },
  { id: 'venue', name: 'Venue Rental', slug: 'venue-rental', parentId: EVENTS },
]

const listing = (name: string, description: string | null = null, tagline: string | null = null) => ({
  name,
  tagline,
  description,
})

describe('suggestSubcategory', () => {
  it('moves a law firm to Law & Legal Services', () => {
    const s = suggestSubcategory(listing('Smith Law Firm', 'We handle divorce and estate cases.'), PRO, CATEGORIES)
    expect(s.suggested?.slug).toBe('law-legal-services')
    expect(s.confidence).toBe('several')
    expect(s.matched).toEqual(expect.arrayContaining(['law', 'law firm', 'divorce']))
  })

  it('moves a party planner to Event Planning, not Party Supplies', () => {
    const s = suggestSubcategory(listing('Atlanta Party Planners'), EVENTS, CATEGORIES)
    expect(s.suggested?.slug).toBe('event-planning')
  })

  it('only suggests children of the group the listing is in', () => {
    const s = suggestSubcategory(listing('Legal Eagles Law Firm'), EVENTS, CATEGORIES)
    expect(s.suggested).toBeNull()
    expect(s.confidence).toBe('none')
  })

  it('weighs the name over a passing mention in the description', () => {
    const s = suggestSubcategory(listing('Bright Books CPA', 'We can also point you to insurance help.'), PRO, CATEGORIES)
    expect(s.suggested?.slug).toBe('accounting-tax-preparation')
    expect(s.confidence).toBe('one')
  })

  it('reads the tagline with the name', () => {
    const s = suggestSubcategory(listing('Peach State Partners', null, 'Your neighborhood bookkeeper'), PRO, CATEGORIES)
    expect(s.suggested?.slug).toBe('accounting-tax-preparation')
  })

  it('suggests nothing on a tie and names both', () => {
    const s = suggestSubcategory(listing('Main Street Notary and Insurance'), PRO, CATEGORIES)
    expect(s.suggested).toBeNull()
    expect(s.confidence).toBe('tie')
    expect(s.tied.map((c) => c.slug).sort()).toEqual(['insurance', 'notary-document-services'])
  })

  it('reads a long description to the end', () => {
    const filler = 'We serve families across the metro with care and patience. '.repeat(8)
    const s = suggestSubcategory(listing('Peach State Partners', `${filler}Book your tax return today.`), PRO, CATEGORIES)
    expect(s.suggested?.slug).toBe('accounting-tax-preparation')
  })

  it('matches whole words only', () => {
    // "lawn" is not "law", "hallway" is not "hall".
    const s = suggestSubcategory(listing('Green Lawn Hallway Co'), PRO, CATEGORIES)
    expect(s.suggested).toBeNull()
    expect(suggestSubcategory(listing('Green Lawn Hallway Co'), EVENTS, CATEGORIES).suggested).toBeNull()
  })
})
