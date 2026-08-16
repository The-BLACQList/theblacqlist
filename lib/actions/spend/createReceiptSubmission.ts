'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { parseReceiptFields, uploadReceiptFile } from '@/lib/spend/receipt-input'

export type ReceiptSubmissionState =
  | { success: true; id: string }
  | { error: string; fieldErrors?: Record<string, string> }
  | null

export async function createReceiptSubmissionAction(
  _prev: ReceiptSubmissionState,
  formData: FormData
): Promise<ReceiptSubmissionState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'You must be signed in to submit a receipt.' }

  const idempotencyKey = formData.get('client_idempotency_key')?.toString().trim() ?? ''
  const fileField = formData.get('receipt_file')

  const parsed = parseReceiptFields(formData)

  if (!idempotencyKey) {
    return { error: 'Invalid submission. Please refresh and try again.' }
  }

  if (!parsed.ok) {
    return { error: parsed.error, fieldErrors: parsed.fieldErrors }
  }

  const fields = parsed.fields
  const serviceClient = createServiceClient()

  // Handle optional file upload
  let filePath: string | null = null
  if (fileField instanceof File && fileField.size > 0) {
    const uploaded = await uploadReceiptFile(serviceClient.storage, user.id, fileField)
    if (!uploaded.ok) {
      return { error: uploaded.error, fieldErrors: uploaded.fieldErrors }
    }
    filePath = uploaded.path
  }

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
    if (error.code === '23505') {
      return { error: 'This receipt has already been submitted.' }
    }
    // A handled `return { error }` never reaches Vercel's runtime-error table,
    // so without this the generic message below is the only evidence that
    // anything went wrong. IDs and Postgres fields only — no user-entered text.
    console.error('[createReceiptSubmission] insert failed:', {
      userId: user.id,
      hasListingId: fields.listingId !== null,
      hasFilePath: filePath !== null,
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    })
    return { error: 'Failed to submit receipt. Please try again.' }
  }

  revalidatePath('/account/receipts')
  return { success: true, id: data.id }
}
