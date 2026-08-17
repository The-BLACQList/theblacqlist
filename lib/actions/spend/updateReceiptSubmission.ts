'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import {
  parseReceiptFields,
  removeReceiptFile,
  uploadReceiptFile,
} from '@/lib/spend/receipt-input'

export type ReceiptCorrectionState =
  | { success: true; id: string }
  | { error: string; fieldErrors?: Record<string, string> }
  | null

/**
 * Correct a receipt the user already submitted.
 *
 * Editing is deliberately confined to `pending_review`. An approved receipt has
 * already written a `spend_events` row and folded its amount into the
 * `flow_nodes` / `flow_edges` totals; changing it would require recomputing
 * those aggregates, which is a separate data decision and not something a user
 * form should trigger. A rejected receipt is terminal — the correction path
 * there is a new submission, which is why the rejection reason is surfaced on
 * the list.
 *
 * `receipt_uploads` carries owner SELECT and INSERT policies but no UPDATE
 * policy, so this writes through the service client — the same route the
 * insert and the account list already take. Ownership is enforced here instead:
 * the row is fetched scoped to the caller, and the write re-asserts both the
 * owner and the pending status so an approval landing between the read and the
 * write cannot be overwritten.
 */
export async function updateReceiptSubmissionAction(
  _prev: ReceiptCorrectionState,
  formData: FormData
): Promise<ReceiptCorrectionState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'You must be signed in to edit a receipt.' }

  const receiptId = formData.get('receipt_id')?.toString().trim() ?? ''
  if (!receiptId) return { error: 'Invalid receipt.' }

  const fileField = formData.get('receipt_file')

  const parsed = parseReceiptFields(formData)
  if (!parsed.ok) {
    return { error: parsed.error, fieldErrors: parsed.fieldErrors }
  }

  const fields = parsed.fields
  const serviceClient = createServiceClient()

  // Scoped to the caller, so another user's receipt is genuinely not found
  // rather than reported as forbidden — which would confirm it exists.
  const { data: existing } = await serviceClient
    .from('receipt_uploads')
    .select('id, status, file_path')
    .eq('id', receiptId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!existing) return { error: 'Receipt not found.' }
  if (existing.status !== 'pending_review') {
    return {
      error:
        existing.status === 'approved'
          ? 'This receipt has been approved and can no longer be edited.'
          : 'This receipt has been reviewed and can no longer be edited. Submit a new one instead.',
    }
  }

  // A replacement photo is optional. With no new file the stored path is left
  // exactly as it was — an edit that only fixes the amount must not detach the
  // image the user already uploaded.
  //
  // `uploadedPath` is tracked separately from `filePath` because the two
  // cleanup decisions below are opposites: if the write lands, the *old* object
  // is now unreferenced; if it doesn't, the *new* one is. Deriving that from
  // `filePath` alone would be guesswork, and guessing wrong deletes a live
  // receipt image rather than an orphan.
  let filePath = existing.file_path
  let uploadedPath: string | null = null
  if (fileField instanceof File && fileField.size > 0) {
    const uploaded = await uploadReceiptFile(serviceClient.storage, user.id, fileField)
    if (!uploaded.ok) {
      return { error: uploaded.error, fieldErrors: uploaded.fieldErrors }
    }
    uploadedPath = uploaded.path
    filePath = uploaded.path
  }

  // `.select('id')` is what makes the row count observable. The `status` guard
  // below can match zero rows without raising an error — an approval landing
  // between the read and the write is exactly that case — and "did this row
  // change?" is the question both the user-facing result and the storage
  // cleanup depend on.
  const { data: updated, error } = await serviceClient
    .from('receipt_uploads')
    .update({
      listing_id: fields.listingId,
      raw_business_name: fields.rawBusinessName,
      file_path: filePath,
      amount_cents: fields.amountCents,
      purchase_date: fields.purchaseDate,
      notes: fields.notes,
      aggregate_opt_out: fields.aggregateOptOut,
    })
    .eq('id', receiptId)
    .eq('user_id', user.id)
    .eq('status', 'pending_review')
    .select('id')

  if (error) {
    // Compensate before returning: the row still points at `existing.file_path`,
    // so the replacement we just uploaded is the unreferenced one. Removing
    // `existing.file_path` here instead would delete the image the receipt is
    // still using.
    if (uploadedPath !== null) {
      await removeReceiptFile(serviceClient.storage, uploadedPath)
    }

    // Same reasoning as the insert path: a handled `return { error }` never
    // reaches Vercel's runtime-error table. IDs and Postgres fields only — no
    // user-entered text.
    console.error('[updateReceiptSubmission] update failed:', {
      userId: user.id,
      receiptId,
      hasListingId: fields.listingId !== null,
      hasFilePath: filePath !== null,
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    })
    return { error: 'Failed to save your changes. Please try again.' }
  }

  // Zero rows matched: the status guard held, which means the receipt was
  // reviewed between the read above and this write. Nothing was saved, so the
  // replacement is the orphan and the stored image stays as it was. Reporting
  // success here would tell the user their correction landed when it did not.
  if (!updated || updated.length === 0) {
    if (uploadedPath !== null) {
      await removeReceiptFile(serviceClient.storage, uploadedPath)
    }
    return {
      error: 'This receipt was reviewed while you were editing it, so your changes were not saved.',
    }
  }

  // The write landed, so the previous object is now referenced by nothing.
  // Removal comes last and never blocks: the row is already correct, and paths
  // are unique per upload (userId/timestamp-uuid.ext), so this cannot detach
  // another receipt's image.
  if (uploadedPath !== null && existing.file_path !== null) {
    await removeReceiptFile(serviceClient.storage, existing.file_path)
  }

  revalidatePath('/account/receipts')
  revalidatePath(`/account/receipts/${receiptId}/edit`)
  return { success: true, id: receiptId }
}
