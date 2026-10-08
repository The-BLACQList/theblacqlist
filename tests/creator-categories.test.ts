// =============================================================================
// lib/listings/creatorCategories.ts: Creators & Influencers is the creator
// path's alone (ticket 131)
// =============================================================================
// Creators add themselves through their own sign-up, which asks "I'm 18 or
// older" [Decision - founder, 2026-10-08]. The business path must never offer a
// Creators category, or a person could be listed without that check.
// =============================================================================

import { describe, it, expect } from 'vitest'

import {
  CREATOR_PARENT_SLUG,
  isCreatorCategory,
  withoutCreatorCategories,
} from '@/lib/listings/creatorCategories'

const CATS = [
  { id: 'food', slug: 'food-dining', parent_id: null },
  { id: 'bakery', slug: 'bakeries', parent_id: 'food' },
  { id: 'social', slug: 'social-media-marketing', parent_id: null },
  { id: 'agency', slug: 'influencer-marketing', parent_id: 'social' },
  { id: 'cre', slug: 'creators-influencers', parent_id: null },
  { id: 'pod', slug: 'podcasters', parent_id: 'cre' },
  { id: 'inf', slug: 'influencers', parent_id: 'cre' },
]

describe('isCreatorCategory', () => {
  it('is true for the parent and its children', () => {
    expect(CREATOR_PARENT_SLUG).toBe('creators-influencers')
    for (const id of ['cre', 'pod', 'inf']) {
      expect(isCreatorCategory(CATS.find((c) => c.id === id)!, CATS)).toBe(true)
    }
  })

  it('is false elsewhere, including the agency category Influencer Marketing', () => {
    for (const id of ['food', 'bakery', 'social', 'agency']) {
      expect(isCreatorCategory(CATS.find((c) => c.id === id)!, CATS)).toBe(false)
    }
  })
})

describe('withoutCreatorCategories', () => {
  it('drops the Creators branch and keeps everything else in order', () => {
    expect(withoutCreatorCategories(CATS).map((c) => c.id)).toEqual([
      'food',
      'bakery',
      'social',
      'agency',
    ])
  })
})
