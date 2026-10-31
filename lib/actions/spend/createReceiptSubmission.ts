'use server'

import { revalidatePath } from 'next/cache'
import { isFeatureEnabled } from '@/lib/env'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import {
  hasReceiptPhoto,
  PHOTO_REQUIRED_MESSAGE,
  parseReceiptFields,
  removeReceiptFile,
  uploadReceiptFile,
} from '@/lib/spend/receipt-input'

export type ReceiptSubmissionState =
  | { success: true; id: string }
  | { error: string; fieldErrors?: Record<string, string> }
  | null

export async function createReceiptSubmissionAction(
  _prev: ReceiptSubmissionState,
  formData: FormData
): Promise<ReceiptSubmissionState> {
  // The Collective is covered until it opens (ticket 122). proxy.ts covers the
  // pages; this stops a direct call to the action.
  if (!isFeatureEnabled('collectiveOpen')) return { error: "The Collective isn't open yet." }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'You must be signed in to add a receipt.' }

  const idempotencyKey = formData.get('client_idempotency_key')?.toString().trim() ?? ''
  const fileField = formData.get('receipt_file')

  // A new receipt needs its photo (ticket 162): without one the review has
  // nothing to check the amount and date against.
  const parsed = parseReceiptFields(formData, { requirePhoto: true })

  if (!idempotencyKey) {
    return { error: 'Invalid submission. Please refresh and try again.' }
  }

  if (!parsed.ok) {
    return { error: parsed.error, fieldErrors: parsed.fieldErrors }
  }

  const fields = parsed.fields
  const serviceClient = createServiceClient()

  // parseReceiptFields has already refused a missing photo; the guard narrows
  // the type and keeps a direct call from inserting a photo-less row.
  if (!hasReceiptPhoto(fileField)) {
    return {
      error: 'Please correct the errors below.',
      fieldErrors: { receipt_file: PHOTO_REQUIRED_MESSAGE },
    }
  }
  const uploaded = await uploadReceiptFile(serviceClient.storage, user.id, fileField)
  if (!uploaded.ok) {
    return { error: uploaded.error, fieldErrors: uploaded.fieldErrors }
  }
  const filePath = uploaded.path

  const { data, error } = await serviceClient
    .from('receipt_uploads')
    .insert({
      user_id: user.id,
      listing_id: fields.listingId,
      raw_business_name: fields.rawBusinessName,
      file_path: filePath,
      amount_cents: fields.amountCents,
      purchase_date: fields.purchaseDate,
      notes: fields.notes,
      aggregate_opt_out: fields.aggregateOptOut,
      client_idempotency_key: idempotencyKey,
      source: 'web',
    })
    .select('id')
    .single()

  if (error) {
    // Compensate: the object is already in the bucket and no row will ever
    // point at it. An orphan in storage is invisible — it survives account
    // deletion too, because deletion collects paths from `file_path` and this
    // path was never written there. Same posture as app/api/upload/route.ts.
    //
    // The duplicate branch below needs this as much as the unexpected ones: the
    // first submission stored its own distinct path (every path carries a fresh
    // UUID), so removing this one cannot detach the receipt that did save.
    await removeReceiptFile(serviceClient.storage, filePath)

    if (error.code === '23505') {
      return { error: 'This receipt has already been submitted.' }
    }
    // A handled `return { error }` never reaches Vercel's runtime-error table,
    // so without this the generic message below is the only evidence that
    // anything went wrong. IDs and Postgres fields only — no user-entered text.
    console.error('[createReceiptSubmission] insert failed:', {
      userId: user.id,
      hasListingId: fields.listingId !== null,
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    })
    return { error: "We couldn't add your receipt. Please try again." }
  }

  revalidatePath('/account/receipts')
  return { success: true, id: data.id }
}
