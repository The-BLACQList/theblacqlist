'use server'

import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/server'
import { getAdminSession, writeAuditLog } from '@/lib/admin/guard'

export type ApproveReceiptState = { success: true } | { error: string } | null

async function upsertFlowNode(
  serviceClient: ReturnType<typeof createServiceClient>,
  nodeType: 'business' | 'city',
  entityId: string,
  amountCents: number
): Promise<string | null> {
  // Try to fetch existing node
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
  serviceClient: ReturnType<typeof createServiceClient>,
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

export async function approveReceiptAction(
  _prev: ApproveReceiptState,
  formData: FormData
): Promise<ApproveReceiptState> {
  const session = await getAdminSession()
  if (!session) return { error: 'Unauthorized.' }

  const receiptId = formData.get('receipt_id')?.toString() ?? ''
  if (!receiptId) return { error: 'Invalid receipt.' }

  const serviceClient = createServiceClient()

  const { data: receipt } = await serviceClient
    .from('receipt_uploads')
    .select('id, listing_id, amount_cents, purchase_date, aggregate_opt_out, status')
    .eq('id', receiptId)
    .single()

  if (!receipt) return { error: 'Receipt not found.' }
  if (receipt.status !== 'pending_review')
    return { error: 'Only pending receipts can be approved.' }

  // 1. Update receipt status
  const { error: updateError } = await serviceClient
    .from('receipt_uploads')
    .update({
      status: 'approved',
      reviewed_by: session.user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', receiptId)

  if (updateError) return { error: 'Failed to approve receipt. Please try again.' }

  // 2. Resolve the listing's city so the spend can be aggregated geographically.
  //    Only on the approval path, and only when a listing is actually linked.
  let cityId: string | null = null
  if (receipt.listing_id) {
    const { data: listing } = await serviceClient
      .from('listings')
      .select('city_id')
      .eq('id', receipt.listing_id)
      .maybeSingle()
    cityId = listing?.city_id ?? null
  }

  // 3. Insert spend_event
  const { data: spendEvent } = await serviceClient
    .from('spend_events')
    .insert({
      receipt_upload_id: receiptId,
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

  // 5. Audit log
  await writeAuditLog({
    adminUserId: session.user.id,
    action: 'receipt_approved',
    targetTable: 'receipt_uploads',
    targetId: receiptId,
    beforeState: { status: 'pending_review' },
    afterState: { status: 'approved' },
  })

  revalidatePath('/admin/receipts')
  revalidatePath('/account/receipts')
  revalidatePath('/account/community-spend')
  return { success: true }
}
