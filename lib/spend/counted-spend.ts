import type { createServiceClient } from '@/lib/supabase/server'
import { readAllRows, type ReadAllResult } from '@/lib/supabase/read-all'

export interface CountedSpendRow {
  id: string
  amount_cents: number
  listing_id: string | null
  created_at: string
}

/**
 * Every receipt that counts toward a community figure, however many there are
 * (ticket 278). The one public read of spend_events: the five pages and APIs
 * that publish a community total all add up these rows, so they can't disagree
 * about what counts.
 *
 * Service client only. The table has no SELECT policy for anyone else.
 */
export function readCountedSpend(
  serviceClient: ReturnType<typeof createServiceClient>
): Promise<ReadAllResult<CountedSpendRow>> {
  return readAllRows((afterId, limit) =>
    serviceClient
      .from('spend_events')
      .select('id, amount_cents, listing_id, created_at', { count: 'exact' })
      .eq('aggregate_opt_out', false)
      // Only businesses on The BLACQList count (ticket 183).
      .not('listing_id', 'is', null)
      .gt('id', afterId)
      .order('id', { ascending: true })
      .limit(limit)
  )
}
