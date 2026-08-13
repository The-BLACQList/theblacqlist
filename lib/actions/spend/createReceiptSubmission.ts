'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export type ReceiptSubmissionState =
  | { success: true; id: string }
  | { error: string; fieldErrors?: Record<string, string> }
  | null

function isUUID(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}

// Must stay in sync with the receipt-uploads bucket's allowed_mime_types
// (supabase/migrations/20260524000000_storage_buckets.sql +
// 20260813010000_receipt_bucket_heic.sql). Checking here means a rejected file
// produces a message the user can act on instead of an opaque storage error.
const RECEIPT_MIME_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'application/pdf': 'pdf',
}

const RECEIPT_BUCKET = 'receipt-uploads'
const MAX_RECEIPT_BYTES = 10 * 1024 * 1024

export async function createReceiptSubmissionAction(
  _prev: ReceiptSubmissionState,
  formData: FormData
): Promise<ReceiptSubmissionState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'You must be signed in to submit a receipt.' }

  const rawBusinessName = formData.get('raw_business_name')?.toString().trim() || null
  const listingIdRaw = formData.get('listing_id')?.toString().trim() || null
  const amountRaw = formData.get('amount_dollars')?.toString().trim() ?? ''
  const purchaseDate = formData.get('purchase_date')?.toString().trim() ?? ''
  const notes = formData.get('notes')?.toString().trim() || null
  const aggregateOptOut = formData.get('aggregate_opt_out') === 'on'
  const idempotencyKey = formData.get('client_idempotency_key')?.toString().trim() ?? ''
  const fileField = formData.get('receipt_file')

  const fieldErrors: Record<string, string> = {}

  if (!rawBusinessName && !listingIdRaw) {
    fieldErrors.raw_business_name = 'Enter a business name or select a business from the directory.'
  }

  const amountFloat = parseFloat(amountRaw)
  if (!amountRaw || isNaN(amountFloat) || amountFloat <= 0) {
    fieldErrors.amount_dollars = 'Enter a valid amount greater than $0.'
  }

  if (!purchaseDate) {
    fieldErrors.purchase_date = 'Purchase date is required.'
  }

  if (!idempotencyKey) {
    return { error: 'Invalid submission. Please refresh and try again.' }
  }

  const listingId = listingIdRaw && isUUID(listingIdRaw) ? listingIdRaw : null

  if (Object.keys(fieldErrors).length > 0) {
    return { error: 'Please correct the errors below.', fieldErrors }
  }

  const amountCents = Math.round(amountFloat * 100)

  const serviceClient = createServiceClient()

  // Handle optional file upload
  let filePath: string | null = null
  if (fileField instanceof File && fileField.size > 0) {
    const ext = RECEIPT_MIME_TYPES[fileField.type]
    if (!ext) {
      return {
        error: 'Receipt file must be a JPEG, PNG, WebP, HEIC image or a PDF.',
        fieldErrors: { receipt_file: 'Unsupported file type.' },
      }
    }
    if (fileField.size > MAX_RECEIPT_BYTES) {
      return {
        error: 'Receipt file must be under 10 MB.',
        fieldErrors: { receipt_file: 'File must be under 10 MB.' },
      }
    }

    // Path is bucket-relative — the bucket itself is the `receipt-uploads`
    // namespace, so prefixing it again would nest a redundant folder.
    const storagePath = `${user.id}/${Date.now()}-${crypto.randomUUID()}.${ext}`

    const { error: uploadError } = await serviceClient.storage
      .from(RECEIPT_BUCKET)
      .upload(storagePath, fileField, { contentType: fileField.type, upsert: false })

    // An upload failure is surfaced, never swallowed. Saving the receipt while
    // silently dropping the photo tells the user their image is stored when it
    // is not — worse than refusing the submission.
    if (uploadError) {
      console.error('[createReceiptSubmission] upload failed:', {
        userId: user.id,
        bucket: RECEIPT_BUCKET,
        contentType: fileField.type,
        message: uploadError.message,
      })
      return {
        error: 'We could not save your receipt photo. Please try again.',
        fieldErrors: { receipt_file: 'Upload failed.' },
      }
    }

    filePath = storagePath
  }

  const { data, error } = await serviceClient
    .from('receipt_uploads')
    .insert({
      user_id: user.id,
      listing_id: listingId,
      raw_business_name: rawBusinessName,
      file_path: filePath,
      amount_cents: amountCents,
      purchase_date: purchaseDate,
      notes,
      aggregate_opt_out: aggregateOptOut,
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
      hasListingId: listingId !== null,
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
