import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { AGGREGATE_MIN_TRANSACTIONS } from '@/lib/spend/aggregate-privacy'

// GET /api/flow-map/summary
// Public. Returns anonymized aggregate flow data.
// Cache: 1 hour ISR.
//
// Every per-entity result — business nodes, city nodes, edges — is gated at
// AGGREGATE_MIN_TRANSACTIONS. The edge query carried that bound from the start;
// the node queries did not, which meant the same page could suppress an edge
// while naming the business on both ends of it.
export const revalidate = 3600

export async function GET() {
  const serviceClient = createServiceClient()

  // Total spend from non-opt-out spend_events
  const { data: spendRows, error: spendError } = await serviceClient
    .from('spend_events')
    .select('amount_cents, listing_id')
    .eq('aggregate_opt_out', false)

  if (spendError) {
    return NextResponse.json(
      { error: 'Failed to load flow data.', code: 'SERVER_ERROR' },
      { status: 500 }
    )
  }

  const rows = spendRows ?? []
  const totalAmountCents = rows.reduce((sum, r) => sum + r.amount_cents, 0)
  const totalTransactions = rows.length
  const uniqueBusinessCount = new Set(rows.map((r) => r.listing_id).filter(Boolean)).size

  // Top business nodes
  const { data: businessNodes } = await serviceClient
    .from('flow_nodes')
    .select('entity_id, total_amount_cents, transaction_count')
    .eq('node_type', 'business')
    .gte('transaction_count', AGGREGATE_MIN_TRANSACTIONS)
    .order('total_amount_cents', { ascending: false })
    .limit(10)

  const businessIds = (businessNodes ?? []).map((n) => n.entity_id)
  let businessMap: Record<string, { name: string; slug: string }> = {}
  if (businessIds.length > 0) {
    const { data: listings } = await serviceClient
      .from('listings')
      .select('id, name, slug')
      .in('id', businessIds)
    businessMap = Object.fromEntries(
      (listings ?? []).map((l) => [l.id, { name: l.name, slug: l.slug }])
    )
  }

  const topBusinesses = (businessNodes ?? []).map((n) => ({
    entity_id: n.entity_id,
    name: businessMap[n.entity_id]?.name ?? 'Unknown Business',
    slug: businessMap[n.entity_id]?.slug ?? '',
    total_amount_cents: n.total_amount_cents,
    transaction_count: n.transaction_count,
  }))

  // Top city nodes
  const { data: cityNodes } = await serviceClient
    .from('flow_nodes')
    .select('entity_id, total_amount_cents, transaction_count')
    .eq('node_type', 'city')
    .gte('transaction_count', AGGREGATE_MIN_TRANSACTIONS)
    .order('total_amount_cents', { ascending: false })
    .limit(10)

  const cityIds = (cityNodes ?? []).map((n) => n.entity_id)
  let cityMap: Record<string, string> = {}
  if (cityIds.length > 0) {
    const { data: cities } = await serviceClient.from('cities').select('id, name').in('id', cityIds)
    cityMap = Object.fromEntries((cities ?? []).map((c) => [c.id, c.name]))
  }

  const topCities = (cityNodes ?? []).map((n) => ({
    entity_id: n.entity_id,
    name: cityMap[n.entity_id] ?? 'Unknown City',
    total_amount_cents: n.total_amount_cents,
    transaction_count: n.transaction_count,
  }))

  // Edges meeting the minimum-transaction threshold (privacy guard)
  const { data: edges } = await serviceClient
    .from('flow_edges')
    .select('id, source_node_id, target_node_id, total_amount_cents, transaction_count')
    .gte('transaction_count', AGGREGATE_MIN_TRANSACTIONS)
    .order('total_amount_cents', { ascending: false })
    .limit(50)

  return NextResponse.json({
    data: {
      total_amount_cents: totalAmountCents,
      total_transactions: totalTransactions,
      unique_businesses: uniqueBusinessCount,
      top_businesses: topBusinesses,
      top_cities: topCities,
      edges: edges ?? [],
    },
  })
}
