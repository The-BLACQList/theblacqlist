"use server"

import { revalidatePath } from "next/cache"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import { getOwnerSession } from "@/lib/dashboard/guard"

export type SubmitVerificationState =
  | { success: true }
  | { error: string }
  | null

export async function submitVerificationRequest(
  _prev: SubmitVerificationState,
  formData: FormData
): Promise<SubmitVerificationState> {
  const session = await getOwnerSession()
  if (!session) return { error: "You must be signed in to submit a verification request." }

  const listingId = formData.get("listing_id")?.toString().trim() ?? ""
  const rawPaths = formData.getAll("doc_paths[]").map((v) => v.toString().trim()).filter(Boolean)

  if (!listingId) return { error: "Missing listing ID." }
  if (rawPaths.length === 0) return { error: "Upload at least one document before submitting." }

  const supabase = await createClient()

  const { data: listing } = await supabase
    .from("listings")
    .select("id, trust_tier, verification_status, owner_user_id")
    .eq("id", listingId)
    .is("deleted_at", null)
    .maybeSingle()

  if (!listing) return { error: "Listing not found." }
  if (listing.owner_user_id !== session.user.id) return { error: "You do not own this listing." }
  if (listing.trust_tier !== "claimed") {
    return { error: "Verification is only available for claimed listings." }
  }
  if (listing.verification_status === "under_review" || listing.verification_status === "verified") {
    return { error: "This listing is already verified or currently under review." }
  }

  const { error: updateError } = await supabase
    .from("listings")
    .update({
      verification_docs: rawPaths,
      verification_status: "pending",
    })
    .eq("id", listingId)

  if (updateError) return { error: "Failed to submit request. Please try again." }

  const serviceClient = createServiceClient()
  await serviceClient.from("moderation_queue").insert({
    entity_id: listingId,
    entity_type: "listing",
    queue_type: "verification",
    status: "pending",
    priority: 0,
  })

  revalidatePath(`/dashboard/pages/${listingId}/verification`)
  return { success: true }
}
