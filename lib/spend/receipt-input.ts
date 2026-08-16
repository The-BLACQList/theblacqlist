// =============================================================================
// Shared receipt field parsing + file upload
// =============================================================================
// Both the create action and the correction action write to the same columns,
// so they must agree on what a valid receipt is. Kept in one place because the
// failure mode of two copies is silent and one-directional: a value the create
// form refuses could be saved through the edit form, and the row would look
// legitimate afterwards. Two real callers, no speculative third.
// =============================================================================

export const RECEIPT_BUCKET = 'receipt-uploads'
export const MAX_RECEIPT_BYTES = 10 * 1024 * 1024

// Must stay in sync with the receipt-uploads bucket's allowed_mime_types
// (supabase/migrations/20260524000000_storage_buckets.sql +
// 20260813010000_receipt_bucket_heic.sql). Checking here means a rejected file
// produces a message the user can act on instead of an opaque storage error.
export const RECEIPT_MIME_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'application/pdf': 'pdf',
}

export interface ReceiptFields {
  rawBusinessName: string | null
  listingId: string | null
  amountCents: number
  purchaseDate: string
  notes: string | null
  aggregateOptOut: boolean
}

export type ReceiptFieldResult =
  | { ok: true; fields: ReceiptFields }
  | { ok: false; error: string; fieldErrors: Record<string, string> }

function isUUID(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}

export function parseReceiptFields(formData: FormData): ReceiptFieldResult {
  const rawBusinessName = formData.get('raw_business_name')?.toString().trim() || null
  const listingIdRaw = formData.get('listing_id')?.toString().trim() || null
  const amountRaw = formData.get('amount_dollars')?.toString().trim() ?? ''
  const purchaseDate = formData.get('purchase_date')?.toString().trim() ?? ''
  const notes = formData.get('notes')?.toString().trim() || null
  const aggregateOptOut = formData.get('aggregate_opt_out') === 'on'

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

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, error: 'Please correct the errors below.', fieldErrors }
  }

  return {
    ok: true,
    fields: {
      rawBusinessName,
      // A malformed id is dropped rather than sent to Postgres, where it would
      // surface as an opaque 22P02 instead of a field the user can fix.
      listingId: listingIdRaw && isUUID(listingIdRaw) ? listingIdRaw : null,
      amountCents: Math.round(amountFloat * 100),
      purchaseDate,
      notes,
      aggregateOptOut,
    },
  }
}

// ─── File upload ──────────────────────────────────────────────────────────────

/**
 * The narrow slice of the Supabase storage client this module uses. Structural
 * so neither caller has to thread a full `SupabaseClient` generic through.
 */
export interface ReceiptStorage {
  from(bucket: string): {
    upload(
      path: string,
      file: File,
      opts: { contentType: string; upsert: boolean }
    ): Promise<{ error: { message: string } | null }>
  }
}

export type ReceiptUploadResult =
  | { ok: true; path: string }
  | { ok: false; error: string; fieldErrors: Record<string, string> }

export async function uploadReceiptFile(
  storage: ReceiptStorage,
  userId: string,
  file: File
): Promise<ReceiptUploadResult> {
  const ext = RECEIPT_MIME_TYPES[file.type]
  if (!ext) {
    return {
      ok: false,
      error: 'Receipt file must be a JPEG, PNG, WebP, HEIC image or a PDF.',
      fieldErrors: { receipt_file: 'Unsupported file type.' },
    }
  }
  if (file.size > MAX_RECEIPT_BYTES) {
    return {
      ok: false,
      error: 'Receipt file must be under 10 MB.',
      fieldErrors: { receipt_file: 'File must be under 10 MB.' },
    }
  }

  // Path is bucket-relative — the bucket itself is the `receipt-uploads`
  // namespace, so prefixing it again would nest a redundant folder.
  const storagePath = `${userId}/${Date.now()}-${crypto.randomUUID()}.${ext}`

  const { error: uploadError } = await storage
    .from(RECEIPT_BUCKET)
    .upload(storagePath, file, { contentType: file.type, upsert: false })

  // An upload failure is surfaced, never swallowed. Saving the receipt while
  // silently dropping the photo tells the user their image is stored when it
  // is not — worse than refusing the write.
  if (uploadError) {
    console.error('[receipt-upload] failed:', {
      userId,
      bucket: RECEIPT_BUCKET,
      contentType: file.type,
      message: uploadError.message,
    })
    return {
      ok: false,
      error: 'We could not save your receipt photo. Please try again.',
      fieldErrors: { receipt_file: 'Upload failed.' },
    }
  }

  return { ok: true, path: storagePath }
}
