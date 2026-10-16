// =============================================================================
// markSuggestionUsed (ticket 138): stamping a suggestion the owner saved.
// It must never throw, must ignore ids from other listings, and must only
// count a save that included the field the suggestion was written for.
// The Supabase client and the ownership check are mocked.
// =============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest'

type Loaded =
  | { ok: true; suggestion: { id: string; listingId: string; agentType: string; suggestionText: string } }
  | { ok: false; error: string }

let loaded: Loaded
let updateError: unknown = null
let updates: Array<Record<string, unknown>> = []
let throwOnFrom = false

vi.mock('@/lib/ai/review', () => ({
  loadOwnedSuggestion: vi.fn(async () => loaded),
}))

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: () => ({
    from: () => {
      if (throwOnFrom) throw new Error('down')
      const chain = {
        select: () => chain,
        eq: () => chain,
        in: () => Promise.resolve({ error: updateError }),
        maybeSingle: () => Promise.resolve({ data: { metadata: { provider: 'mock' } } }),
        update: (row: Record<string, unknown>) => (updates.push(row), chain),
      }
      return chain
    },
  }),
}))

import { markSuggestionUsed } from '@/lib/ai/markUsed'
import { loadOwnedSuggestion } from '@/lib/ai/review'

function ownedAbout(listingId = 'L1', text = 'Suggested about') {
  loaded = {
    ok: true,
    suggestion: { id: 's1', listingId, agentType: 'listing_description', suggestionText: text },
  }
}

describe('markSuggestionUsed', () => {
  beforeEach(() => {
    updates = []
    updateError = null
    throwOnFrom = false
    ownedAbout()
  })

  it('marks an owned suggestion applied when its field was saved', async () => {
    const ok = await markSuggestionUsed({
      suggestionId: 's1',
      listingId: 'L1',
      userId: 'u1',
      saved: { description: 'Suggested about' },
    })
    expect(ok).toBe(true)
    expect(updates[0]).toMatchObject({ status: 'applied', reviewed_by: 'u1' })
    expect(updates[0]?.metadata).toEqual({ provider: 'mock', edited_before_save: false })
    expect(loadOwnedSuggestion).toHaveBeenCalledWith('s1', 'u1', ['pending', 'approved'])
  })

  it('records when the owner changed the words before saving', async () => {
    await markSuggestionUsed({
      suggestionId: 's1',
      listingId: 'L1',
      userId: 'u1',
      saved: { description: 'My own version' },
    })
    expect(updates[0]?.metadata).toMatchObject({ edited_before_save: true })
  })

  it('ignores a suggestion from another listing', async () => {
    ownedAbout('OTHER')
    const ok = await markSuggestionUsed({
      suggestionId: 's1',
      listingId: 'L1',
      userId: 'u1',
      saved: { description: 'x' },
    })
    expect(ok).toBe(false)
    expect(updates).toEqual([])
  })

  it('ignores a suggestion the user does not own', async () => {
    loaded = { ok: false, error: 'nope' }
    expect(
      await markSuggestionUsed({ suggestionId: 's1', listingId: 'L1', userId: 'u2', saved: { description: 'x' } })
    ).toBe(false)
    expect(updates).toEqual([])
  })

  it('ignores a save that did not include the suggestion field', async () => {
    const ok = await markSuggestionUsed({
      suggestionId: 's1',
      listingId: 'L1',
      userId: 'u1',
      saved: { meta_title: 'A title' },
    })
    expect(ok).toBe(false)
    expect(updates).toEqual([])
  })

  it('ignores a copy-only suggestion with no field to land in', async () => {
    loaded = {
      ok: true,
      suggestion: { id: 's1', listingId: 'L1', agentType: 'social_caption_instagram', suggestionText: 'x' },
    }
    expect(
      await markSuggestionUsed({ suggestionId: 's1', listingId: 'L1', userId: 'u1', saved: { description: 'x' } })
    ).toBe(false)
  })

  it('returns false instead of throwing when the database fails', async () => {
    throwOnFrom = true
    await expect(
      markSuggestionUsed({ suggestionId: 's1', listingId: 'L1', userId: 'u1', saved: { description: 'x' } })
    ).resolves.toBe(false)
  })

  it('returns false when the update fails', async () => {
    updateError = { message: 'denied' }
    expect(
      await markSuggestionUsed({ suggestionId: 's1', listingId: 'L1', userId: 'u1', saved: { description: 'x' } })
    ).toBe(false)
  })
})
