import { NextRequest, NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'

import { refuseUnauthorizedCron } from '@/lib/cron/auth'
import { isFeatureEnabled } from '@/lib/env'
import { voyageKey } from '@/lib/search/voyage'
import {
  supabaseEmbeddingStore,
  syncListingEmbeddings,
  voyageDocumentEmbedder,
} from '@/lib/services/listingEmbeddings'
import { createServiceClient } from '@/lib/supabase/server'

/**
 * =============================================================================
 * Daily meaning-search cron (ticket 259)
 * =============================================================================
 *
 * Embeds searchable listings that are new or changed since the last run, and
 * drops rows for listings no longer shown. The rules live in
 * `lib/services/listingEmbeddings.ts` and the 20261206000000 migration. This
 * file is auth and plumbing on purpose.
 *
 * Gated by FEATURE_SEMANTIC_SEARCH (closed by default on every deployment).
 * Off, nothing is sent to Voyage. `?dry=1` works either way: it counts what a
 * real run would embed and estimates the tokens, with no Voyage call and no
 * write, so the first real run can be priced before it happens.
 * =============================================================================
 */

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: NextRequest): Promise<NextResponse> {
  const refused = refuseUnauthorizedCron(request, 'embeddings')
  if (refused) return refused

  const now = new Date()
  const dry = request.nextUrl.searchParams.get('dry') === '1'

  if (!dry && !isFeatureEnabled('semanticSearch')) {
    return NextResponse.json({ ranAt: now.toISOString(), skipped: 'semanticSearch feature flag is off' })
  }
  if (!dry && !voyageKey()) {
    console.error('[cron/embeddings] VOYAGE_API_KEY is not set — skipping.')
    return NextResponse.json({ ranAt: now.toISOString(), skipped: 'VOYAGE_API_KEY is not set' }, { status: 503 })
  }

  try {
    // The new table and functions aren't in the generated types yet.
    const supabase = createServiceClient() as unknown as SupabaseClient
    const summary = await syncListingEmbeddings(supabaseEmbeddingStore(supabase), voyageDocumentEmbedder, { dry, now })
    // A run where every batch failed is a red run, not a quiet one.
    const status = summary.failedBatches > 0 && summary.embedded === 0 ? 500 : 200
    return NextResponse.json({ ranAt: now.toISOString(), ...summary }, { status })
  } catch (err) {
    console.error('[cron/embeddings] run failed:', err)
    return NextResponse.json(
      { ranAt: now.toISOString(), error: err instanceof Error ? err.message : 'unknown error' },
      { status: 500 }
    )
  }
}
