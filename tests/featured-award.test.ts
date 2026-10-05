// =============================================================================
// lib/featured/award.ts: the weekly Featured run, around the SQL function
// =============================================================================
// The scoring itself is tested against real Postgres in
// tests/migrations/earned-featured.test.ts. These pin what the app sends it
// (which week, which buckets, Jobs left out) and how the answer is reported.
// =============================================================================

import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'

import { awardWeeklyFeatured } from '@/lib/featured/award'

const FOOD = '11111111-1111-1111-1111-111111111111'

function stubClient(rpcResult: { data: unknown; error: { message: string } | null }) {
  const rpc = vi.fn().mockResolvedValue(rpcResult)
  const client = {
    from: () => ({
      select: () =>
        Promise.resolve({ data: [{ id: FOOD, slug: 'food-dining', parent_id: null }], error: null }),
    }),
    rpc,
  }
  return { client: client as unknown as SupabaseClient, rpc }
}

describe('awardWeeklyFeatured', () => {
  it('scores last week, with the live buckets and Jobs left out', async () => {
    const { client, rpc } = stubClient({
      data: [
        { listing_id: 'a', bucket: 'restaurant', score: '8', featured: true },
        { listing_id: 'b', bucket: null, score: null, featured: false },
      ],
      error: null,
    })

    const summary = await awardWeeklyFeatured(client, new Date('2026-10-05T09:00:00Z'))

    expect(rpc).toHaveBeenCalledWith('award_weekly_featured', {
      p_week_start: '2026-09-28',
      p_buckets: expect.arrayContaining([
        expect.objectContaining({ bucket: 'restaurant', category_ids: [FOOD] }),
      ]),
      p_excluded_types: ['job'],
    })
    expect(summary).toEqual({
      weekStart: '2026-09-28',
      winners: [{ listingId: 'a', bucket: 'restaurant', score: 8 }],
      cleared: ['b'],
    })
  })

  it('surfaces a refusal from the database', async () => {
    const { client } = stubClient({ data: null, error: { message: 'older than the latest run' } })
    await expect(awardWeeklyFeatured(client, new Date('2026-10-05T09:00:00Z'))).rejects.toThrow(
      /older than the latest run/
    )
  })
})
