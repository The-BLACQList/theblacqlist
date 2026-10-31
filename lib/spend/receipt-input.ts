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

// The two limits a receipt is held to (ticket 162). Named so the form, the
// server check and the tests all read the same numbers.
export const MAX_RECEIPT_AMOUNT_CENTS = 1_000_000 // $10,000
export const MAX_RECEIPT_AGE_DAYS = 90

export const PHOTO_REQUIRED_MESSAGE = 'Add a photo of your receipt.'

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

/** `YYYY-MM-DD` for a UTC calendar day, the same shape the date input sends. */
export function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/** `YYYY-MM-DD` for the calendar day on this device's clock. */
export function localIsoDay(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function shiftIsoDay(day: string, days: number): string {
  const d = new Date(`${day}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return isoDay(d)
}

/**
 * The oldest and newest purchase dates a receipt may carry, counted from the
 * shopper's own `today` (`YYYY-MM-DD`). The form uses this for its date limits.
 */
export function receiptDateBounds(today: string): { min: string; max: string } {
  return { min: shiftIsoDay(today, -MAX_RECEIPT_AGE_DAYS), max: today }
}

function isRealIsoDay(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00Z`)
  return !isNaN(parsed.getTime()) && isoDay(parsed) === value
}

/** A chosen file, as opposed to the empty part a blank file input still sends. */
export function hasReceiptPhoto(field: FormDataEntryValue | null): field is File {
  return field instanceof File && field.size > 0
}

export interface ParseReceiptOptions {
  /** New receipts need a photo. Edits keep the stored one, so the caller decides. */
  requirePhoto?: boolean
  /** Injected so the date window is testable. Defaults to now. */
  today?: Date
}

export function parseReceiptFields(
  formData: FormData,
  { requirePhoto = false, today = new Date() }: ParseReceiptOptions = {}
): ReceiptFieldResult {
  const rawBusinessName = formData.get('raw_business_name')?.toString().trim() || null
  const listingIdRaw = formData.get('listing_id')?.toString().trim() || null
  const amountRaw = formData.get('amount_dollars')?.toString().trim() ?? ''
  const purchaseDate = formData.get('purchase_date')?.toString().trim() ?? ''
  const notes = formData.get('notes')?.toString().trim() || null
  const aggregateOptOut = formData.get('aggregate_opt_out') === 'on'

  const fieldErrors: Record<string, string> = {}

  if (requirePhoto && !hasReceiptPhoto(formData.get('receipt_file'))) {
    fieldErrors.receipt_file = PHOTO_REQUIRED_MESSAGE
  }

  if (!rawBusinessName && !listingIdRaw) {
    fieldErrors.raw_business_name = 'Enter a business name or select a business from the directory.'
  }

  // Checked in cents, after rounding, so "0.004" is refused rather than saved
  // as a $0 receipt.
  const amountFloat = parseFloat(amountRaw)
  const amountCents = Math.round(amountFloat * 100)
  if (!amountRaw || isNaN(amountFloat) || amountCents <= 0) {
    fieldErrors.amount_dollars = 'Enter an amount greater than $0.'
  } else if (amountCents > MAX_RECEIPT_AMOUNT_CENTS) {
    fieldErrors.amount_dollars = 'Enter an amount of $10,000 or less.'
  }

  // The server only knows UTC, and the shopper's today can sit a day either
  // side of it. One day of slack on each end lets every time zone's today and
  // 90th day through; the form holds the shopper to their own calendar.
  const utcBounds = receiptDateBounds(isoDay(today))
  const min = shiftIsoDay(utcBounds.min, -1)
  const max = shiftIsoDay(utcBounds.max, 1)
  if (!purchaseDate) {
    fieldErrors.purchase_date = 'Purchase date is required.'
  } else if (!isRealIsoDay(purchaseDate)) {
    fieldErrors.purchase_date = 'Enter a real date.'
  } else if (purchaseDate > max) {
    fieldErrors.purchase_date = "The date can't be in the future."
  } else if (purchaseDate < min) {
    fieldErrors.purchase_date = `Add receipts from the last ${MAX_RECEIPT_AGE_DAYS} days.`
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
      amountCents,
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
    remove(paths: string[]): Promise<{ error: { message: string } | null }>
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
      fieldErrors: { receipt_file: 'Use a JPEG, PNG, WebP or HEIC photo, or a PDF.' },
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
      error: "Your photo didn't upload. Try again.",
      fieldErrors: { receipt_file: "Your photo didn't upload. Try again." },
    }
  }

  return { ok: true, path: storagePath }
}

/**
 * Best-effort removal of a stored receipt object. Compensation only — every
 * caller has already decided what the row says, so a failed removal must not
 * change what the user is told. Follows the same posture as the media upload
 * route (app/api/upload/route.ts) and account deletion, both of which treat
 * storage cleanup as non-blocking.
 *
 * Never throws. An orphan is invisible and permanent; a thrown error here
 * would turn a successful edit into a failed one, which is strictly worse.
 */
export async function removeReceiptFile(storage: ReceiptStorage, path: string): Promise<void> {
  try {
    const { error } = await storage.from(RECEIPT_BUCKET).remove([path])
    if (error) {
      console.error('[receipt-remove] failed:', { bucket: RECEIPT_BUCKET, message: error.message })
    }
  } catch (err) {
    console.error('[receipt-remove] threw:', {
      bucket: RECEIPT_BUCKET,
      message: err instanceof Error ? err.message : 'unknown',
    })
  }
}
