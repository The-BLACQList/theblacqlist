// =============================================================================
// Approve or reject a pending receipt (shared by admin and owner reviews)
// =============================================================================
// Ticket 183 lets business owners verify receipts as well as admins, so the
// writes live here once. Both updates are guarded with
// `.eq('status', 'pending_review')` and check that a row came back: if an
// owner and an admin press at the same moment, only the first one counts, and
// spend_events and the flow graph are written once.
//
// Only businesses on The BLACQList count. `[Decision — founder, 2026-11-13]`
// A receipt with no listing can't be approved: it waits until the shopper
// links it to a listed business (see lib/spend/unlisted.ts).
//
// Server only: takes the service client.
// =============================================================================

import type { createServiceClient } from '@/lib/supabase/server'

type ServiceClient = ReturnType<typeof createServiceClient>

export type ReviewerRole = 'owner' | 'admin'

export interface PendingReceipt {
  id: string
  listing_id: string | null
  amount_cents: number
  purchase_date: string
  aggregate_opt_out: boolean
}

export type ReviewResult<T = object> =
  | ({ ok: true } & T)
  | { ok: false; reason: 'already_reviewed' | 'failed' | 'unlisted' }

async function upsertFlowNode(
  serviceClient: ServiceClient,
  nodeType: 'business' | 'city',
  entityId: string,
  amountCents: number
): Promise<string | null> {
  const { data: existing } = await serviceClient
    .from('flow_nodes')
    .select('id, total_amount_cents, transaction_count')
    .eq('node_type', nodeType)
    .eq('entity_id', entityId)
    .maybeSingle()

  if (existing) {
    await serviceClient
      .from('flow_nodes')
      .update({
        total_amount_cents: existing.total_amount_cents + amountCents,
        transaction_count: existing.transaction_count + 1,
        last_transaction_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
    return existing.id
  }

  const { data: created } = await serviceClient
    .from('flow_nodes')
    .insert({
      node_type: nodeType,
      entity_id: entityId,
      total_amount_cents: amountCents,
      transaction_count: 1,
      last_transaction_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  return created?.id ?? null
}

/**
 * Accumulate one transaction onto the business -> city edge.
 *
 * business -> city is the ONLY edge the shipped schema can express: flow_nodes'
 * CHECK permits 'business' | 'city' and nothing else. Same select-then-write
 * shape as upsertFlowNode, and deliberately NOT the SQL from ticket 067 — the
 * shipped flow_edges has five columns only (no last_transaction_at, no
 * created_at/updated_at), so that INSERT would fail on a column that
 * doesn't exist.
 */
async function upsertFlowEdge(
  serviceClient: ServiceClient,
  sourceNodeId: string,
  targetNodeId: string,
  amountCents: number
): Promise<void> {
  const { data: existing } = await serviceClient
    .from('flow_edges')
    .select('id, total_amount_cents, transaction_count')
    .eq('source_node_id', sourceNodeId)
    .eq('target_node_id', targetNodeId)
    .maybeSingle()

  if (existing) {
    await serviceClient
      .from('flow_edges')
      .update({
        total_amount_cents: existing.total_amount_cents + amountCents,
        transaction_count: existing.transaction_count + 1,
      })
      .eq('id', existing.id)
    return
  }

  await serviceClient.from('flow_edges').insert({
    source_node_id: sourceNodeId,
    target_node_id: targetNodeId,
    total_amount_cents: amountCents,
    transaction_count: 1,
  })
}

/**
 * Approve a pending receipt and count it: status, spend_event, flow graph.
 * Returns the listing name for the shopper's email.
 */
export async function approvePendingReceipt(
  serviceClient: ServiceClient,
  receipt: PendingReceipt,
  reviewer: { userId: string; role: ReviewerRole }
): Promise<ReviewResult<{ listingName: string | null }>> {
  // 0. Only receipts for a business on The BLACQList are counted.
  if (!receipt.listing_id) return { ok: false, reason: 'unlisted' }

  // 1. Update the status, only if it is still pending. No row back means
  //    someone else reviewed it first.
  const { data: updated, error: updateError } = await serviceClient
    .from('receipt_uploads')
    .update({
      status: 'approved',
      reviewed_by: reviewer.userId,
      reviewed_at: new Date().toISOString(),
      verified_by_role: reviewer.role,
    })
    .eq('id', receipt.id)
    .eq('status', 'pending_review')
    .select('id')

  if (updateError) return { ok: false, reason: 'failed' }
  if (!updated || updated.length === 0) return { ok: false, reason: 'already_reviewed' }

  // 2. Resolve the listing's city so the spend can be aggregated geographically.
  //    Only when a listing is actually linked. The name rides along for the
  //    counted email (ticket 165).
  let cityId: string | null = null
  let listingName: string | null = null
  if (receipt.listing_id) {
    const { data: listing } = await serviceClient
      .from('listings')
      .select('city_id, name')
      .eq('id', receipt.listing_id)
      .maybeSingle()
    cityId = listing?.city_id ?? null
    listingName = listing?.name ?? null
  }

  // 3. Insert spend_event
  const { data: spendEvent } = await serviceClient
    .from('spend_events')
    .insert({
      receipt_upload_id: receipt.id,
      listing_id: receipt.listing_id ?? null,
      city_id: cityId,
      amount_cents: receipt.amount_cents,
      purchase_date: receipt.purchase_date,
      aggregate_opt_out: receipt.aggregate_opt_out,
      source: 'receipt_upload',
    })
    .select('id')
    .single()

  // 4. Accumulate the flow graph: a business node, a city node when the listing
  //    has one, and the business -> city edge between them. All three feed
  //    /account/community-spend and /api/flow-map/summary.
  //
  //    Opted-out spend never enters the graph. flow_nodes carries no opt-out
  //    column, so exclusion can only happen here at write time -- and it has to,
  //    because the same public page reads both rules at once: /flow-map's
  //    headline queries spend_events with .eq('aggregate_opt_out', false) while
  //    the named-business table directly beneath it reads flow_nodes. Without
  //    this guard a user who opted out is excluded from the total and still
  //    counted in the ranking under it. One rule, both figures.
  if (spendEvent && receipt.listing_id && !receipt.aggregate_opt_out) {
    const businessNodeId = await upsertFlowNode(
      serviceClient,
      'business',
      receipt.listing_id,
      receipt.amount_cents
    )

    if (cityId) {
      const cityNodeId = await upsertFlowNode(serviceClient, 'city', cityId, receipt.amount_cents)
      if (businessNodeId && cityNodeId) {
        await upsertFlowEdge(serviceClient, businessNodeId, cityNodeId, receipt.amount_cents)
      }
    }
  }

  return { ok: true, listingName }
}

/** Reject a pending receipt, only if it is still pending. */
export async function rejectPendingReceipt(
  serviceClient: ServiceClient,
  receiptId: string,
  reviewer: { userId: string; role: ReviewerRole },
  rejectionReason: string | null
): Promise<ReviewResult> {
  const { data: updated, error } = await serviceClient
    .from('receipt_uploads')
    .update({
      status: 'rejected',
      rejection_reason: rejectionReason,
      reviewed_by: reviewer.userId,
      reviewed_at: new Date().toISOString(),
      verified_by_role: reviewer.role,
    })
    .eq('id', receiptId)
    .eq('status', 'pending_review')
    .select('id')

  if (error) return { ok: false, reason: 'failed' }
  if (!updated || updated.length === 0) return { ok: false, reason: 'already_reviewed' }
  return { ok: true }
}
