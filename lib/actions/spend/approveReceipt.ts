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

  // 2. Insert spend_event
  const { data: spendEvent } = await serviceClient
    .from('spend_events')
    .insert({
      receipt_upload_id: receiptId,
      listing_id: receipt.listing_id ?? null,
      amount_cents: receipt.amount_cents,
      purchase_date: receipt.purchase_date,
      aggregate_opt_out: receipt.aggregate_opt_out,
      source: 'receipt_upload',
    })
    .select('id')
    .single()

  // 3. Update flow_nodes/edges if listing is linked
  if (spendEvent && receipt.listing_id) {
    await upsertFlowNode(serviceClient, 'business', receipt.listing_id, receipt.amount_cents)
  }

  // 4. Audit log
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
