// =============================================================================
// lib/constants/listing.ts: ownershipLabelText (ticket 132)
// =============================================================================
// [Decision - founder, 2026-10-08] Creator pages use the same two stored
// labels, worded for a person: "Black Creator / Ally Creator".
// =============================================================================

import { describe, it, expect } from 'vitest'

import { OWNERSHIP_LABEL_META, ownershipLabelText } from '@/lib/constants/listing'

describe('ownershipLabelText', () => {
  it('words the labels for a person on creator pages', () => {
    expect(ownershipLabelText('black_owned', 'creator')).toBe('Black Creator')
    expect(ownershipLabelText('ally', 'creator')).toBe('Ally Creator')
  })

  it('keeps the business wording on every other type', () => {
    for (const type of ['business', 'restaurant', 'vendor', 'event', null, undefined]) {
      expect(ownershipLabelText('black_owned', type)).toBe(OWNERSHIP_LABEL_META.black_owned.label)
      expect(ownershipLabelText('ally', type)).toBe(OWNERSHIP_LABEL_META.ally.label)
    }
  })
})
