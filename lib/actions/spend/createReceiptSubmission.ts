"use server"

import { revalidatePath } from "next/cache"
import { createClient, createServiceClient } from "@/lib/supabase/server"

export type ReceiptSubmissionState =
  | { success: true; id: string }
  | { error: string; fieldErrors?: Record<string, string> }
  | null

function isUUID(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}

export async function createReceiptSubmissionAction(
  _prev: ReceiptSubmissionState,
  formData: FormData
): Promise<ReceiptSubmissionState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "You must be signed in to submit a receipt." }

  const rawBusinessName = formData.get("raw_business_name")?.toString().trim() || null
  const listingIdRaw = formData.get("listing_id")?.toString().trim() || null
  const amountRaw = formData.get("amount_dollars")?.toString().trim() ?? ""
  const purchaseDate = formData.get("purchase_date")?.toString().trim() ?? ""
  const notes = formData.get("notes")?.toString().trim() || null
  const aggregateOptOut = formData.get("aggregate_opt_out") === "on"
  const idempotencyKey = formData.get("client_idempotency_key")?.toString().trim() ?? ""
  const fileField = formData.get("receipt_file")

  const fieldErrors: Record<string, string> = {}

  if (!rawBusinessName && !listingIdRaw) {
    fieldErrors.raw_business_name = "Enter a business name or select a business from the directory."
  }

  const amountFloat = parseFloat(amountRaw)
  if (!amountRaw || isNaN(amountFloat) || amountFloat <= 0) {
    fieldErrors.amount_dollars = "Enter a valid amount greater than $0."
  }

  if (!purchaseDate) {
    fieldErrors.purchase_date = "Purchase date is required."
  }

  if (!idempotencyKey) {
    return { error: "Invalid submission. Please refresh and try again." }
  }

  const listingId = listingIdRaw && isUUID(listingIdRaw) ? listingIdRaw : null

  if (Object.keys(fieldErrors).length > 0) {
    return { error: "Please correct the errors below.", fieldErrors }
  }

  const amountCents = Math.round(amountFloat * 100)

  // Handle optional file upload
  let filePath: string | null = null
  if (fileField instanceof File && fileField.size > 0) {
    if (!fileField.type.startsWith("image/")) {
      return { error: "Receipt file must be an image (JPEG, PNG, HEIC, etc.).", fieldErrors: { receipt_file: "File must be an image." } }
    }
    if (fileField.size > 10 * 1024 * 1024) {
      return { error: "Receipt file must be under 10 MB.", fieldErrors: { receipt_file: "File must be under 10 MB." } }
    }

    const ext = fileField.name.split(".").pop()?.toLowerCase() ?? "jpg"
    const timestamp = Date.now()
    const storagePath = `receipts/${user.id}/${timestamp}-${crypto.randomUUID()}.${ext}`

    const serviceClient = createServiceClient()
    const { error: uploadError } = await serviceClient
      .storage
      .from("receipts")
      .upload(storagePath, fileField, { contentType: fileField.type, upsert: false })

    if (uploadError) {
      // If bucket not found, proceed without file — storage setup may be pending
      if (!uploadError.message?.includes("Bucket not found") && !uploadError.message?.includes("not found")) {
        return { error: "Failed to upload receipt image. Please try again." }
      }
      // Bucket not yet set up — allow submission without file path
    } else {
      filePath = storagePath
    }
  }

  const serviceClient = createServiceClient()
  const { data, error } = await serviceClient
    .from("receipt_uploads")
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
      source: "web",
    })
    .select("id")
    .single()

  if (error) {
    if (error.code === "23505") {
      return { error: "This receipt has already been submitted." }
    }
    return { error: "Failed to submit receipt. Please try again." }
  }

  revalidatePath("/account/receipts")
  return { success: true, id: data.id }
}
