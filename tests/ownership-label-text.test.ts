// =============================================================================
// lib/constants/listing.ts: ownershipLabelText (ticket 132)
// =============================================================================
// [Decision - founder, 2026-10-19] Creator pages store the same two values.
// Only an ally page is labeled ("Ally Creator"); there is no Black Creator label.
// =============================================================================

import { describe, it, expect } from 'vitest'

import { OWNERSHIP_LABEL_META, ownershipLabelText } from '@/lib/constants/listing'

describe('ownershipLabelText', () => {
  it('words the ally label for a person on creator pages', () => {
    expect(ownershipLabelText('ally', 'creator')).toBe('Ally Creator')
  })

  it('never words a Black Creator label', () => {
    expect(ownershipLabelText('black_owned', 'creator')).not.toBe('Black Creator')
  })

  it('keeps the business wording on every other type', () => {
    for (const type of ['business', 'restaurant', 'vendor', 'event', null, undefined]) {
      expect(ownershipLabelText('black_owned', type)).toBe(OWNERSHIP_LABEL_META.black_owned.label)
      expect(ownershipLabelText('ally', type)).toBe(OWNERSHIP_LABEL_META.ally.label)
    }
  })
})
