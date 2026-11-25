import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { readCountedSpend } from '@/lib/spend/counted-spend'
import { AGGREGATE_MIN_TRANSACTIONS, communityTotals } from '@/lib/spend/aggregate-privacy'

// GET /api/community-spend
// Public endpoint — returns anonymized community spend aggregates.
// Cached 1 hour. No user IDs exposed.
//
// Per-entity rows (named businesses, named cities) are gated at
// AGGREGATE_MIN_TRANSACTIONS. This endpoint is unauthenticated and
// machine-readable, so a sub-threshold row here is the most quotable version of
// the disclosure — it returns the business name, its exact total, and the
// transaction count in one JSON object.
export const revalidate = 3600

export async function GET() {
  const serviceClient = createServiceClient()

  // Total approved spend (excluding opt-outs)
  const { data: totalData, error: totalError } = await readCountedSpend(serviceClient)

  if (totalError) {
    return NextResponse.json(
      { error: 'Failed to load community spend.', code: 'SERVER_ERROR' },
      { status: 500 }
    )
  }

  // Null while too few receipts are counted site-wide (ticket 286).
  const totals = communityTotals(totalData)

  // Top businesses by spend (via flow_nodes)
  const { data: topBusinesses } = await serviceClient
    .from('flow_nodes')
    .select('entity_id, total_amount_cents, transaction_count')
    .eq('node_type', 'business')
    .gte('transaction_count', AGGREGATE_MIN_TRANSACTIONS)
    .order('total_amount_cents', { ascending: false })
    .limit(10)

  // Enrich top businesses with listing name
  const topBusinessIds = (topBusinesses ?? []).map((n) => n.entity_id)
  let businessNames: Record<string, string> = {}
  if (topBusinessIds.length > 0) {
    const { data: listings } = await serviceClient
      .from('listings')
      .select('id, name, slug')
      .in('id', topBusinessIds)

    businessNames = Object.fromEntries((listings ?? []).map((l) => [l.id, l.name]))
  }

  const topBusinessesEnriched = (topBusinesses ?? []).map((n) => ({
    entity_id: n.entity_id,
    name: businessNames[n.entity_id] ?? 'Unknown Business',
    total_amount_cents: n.total_amount_cents,
    transaction_count: n.transaction_count,
  }))

  // Top cities by spend
  const { data: topCities } = await serviceClient
    .from('flow_nodes')
    .select('entity_id, total_amount_cents, transaction_count')
    .eq('node_type', 'city')
    .gte('transaction_count', AGGREGATE_MIN_TRANSACTIONS)
    .order('total_amount_cents', { ascending: false })
    .limit(10)

  const topCityIds = (topCities ?? []).map((n) => n.entity_id)
  let cityNames: Record<string, string> = {}
  if (topCityIds.length > 0) {
    const { data: cities } = await serviceClient
      .from('cities')
      .select('id, name')
      .in('id', topCityIds)

    cityNames = Object.fromEntries((cities ?? []).map((c) => [c.id, c.name]))
  }

  const topCitiesEnriched = (topCities ?? []).map((n) => ({
    entity_id: n.entity_id,
    name: cityNames[n.entity_id] ?? 'Unknown City',
    total_amount_cents: n.total_amount_cents,
    transaction_count: n.transaction_count,
  }))

  return NextResponse.json({
    data: {
      total_amount_cents: totals?.amountCents ?? null,
      total_transactions: totals?.receipts ?? null,
      top_businesses: topBusinessesEnriched,
      top_cities: topCitiesEnriched,
    },
  })
}
