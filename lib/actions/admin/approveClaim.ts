"use server"

import { createServiceClient } from "@/lib/supabase/server"
import { getAdminSession, writeAuditLog } from "@/lib/admin/guard"
import { sendEmail } from "@/lib/email/resend"
import { ClaimApprovedEmail } from "@/lib/email/templates/claim-approved"

export type ApproveClaimState =
  | { success: true; claimId: string; listingId: string }
  | { error: string }
  | null

export async function approveClaimAction(
  _prev: ApproveClaimState,
  formData: FormData
): Promise<ApproveClaimState> {
  const admin = await getAdminSession()
  if (!admin) return { error: "You do not have permission to perform this action." }

  const claimId = formData.get("claim_id")?.toString().trim() ?? ""
  const notes = formData.get("notes")?.toString().trim() || null

  if (!claimId) return { error: "Missing claim ID." }

  const serviceClient = createServiceClient()

  // Fetch claim with listing context
  const { data: claim } = await serviceClient
    .from("claims")
    .select("id, status, claimant_user_id, listing_id, listings!claims_listing_id_fkey(id, name, trust_tier, owner_user_id)")
    .eq("id", claimId)
    .maybeSingle()

  if (!claim) return { error: "Claim not found." }

  if (!["pending", "under_review"].includes(claim.status)) {
    return { error: "This claim is not in a reviewable state." }
  }

  // No self-approval: admin cannot approve their own claim
  if (claim.claimant_user_id === admin.user.id) {
    return { error: "You cannot approve a claim you submitted." }
  }

  if (!claim.claimant_user_id) {
    return { error: "Claim has no associated user. Cannot approve." }
  }

  const listing = claim.listings as { id: string; name: string; trust_tier: string; owner_user_id: string | null } | null
  if (!listing) return { error: "Associated listing not found." }

  const now = new Date().toISOString()

  // 1. Update claim status
  const { error: claimError } = await serviceClient
    .from("claims")
    .update({
      status: "approved",
      reviewed_by: admin.user.id,
      reviewed_at: now,
    })
    .eq("id", claimId)

  if (claimError) return { error: "Failed to approve claim. Please try again." }

  // 2. Update listing trust_tier and owner
  const { error: listingError } = await serviceClient
    .from("listings")
    .update({
      trust_tier: "claimed",
      owner_user_id: claim.claimant_user_id,
      last_admin_updated_at: now,
    })
    .eq("id", claim.listing_id)

  if (listingError) {
    // Attempt rollback on claim (best-effort)
    await serviceClient
      .from("claims")
      .update({ status: "pending", reviewed_by: null, reviewed_at: null })
      .eq("id", claimId)
    return { error: "Failed to update listing ownership. Claim rolled back to pending." }
  }

  // 3. Grant owner role — insert, ignore if already exists
  await serviceClient.from("user_roles").insert({
    user_id: claim.claimant_user_id,
    role: "owner",
    listing_id: claim.listing_id,
    granted_by: admin.user.id,
  })
  // Ignore duplicate role error — owner role may already exist from prior claim or direct grant

  // 4. Resolve moderation queue
  await serviceClient
    .from("moderation_queue")
    .update({ status: "resolved", resolved_at: now })
    .eq("entity_id", claimId)
    .eq("entity_type", "claim")
    .in("status", ["pending", "assigned"])

  void writeAuditLog({
    adminUserId: admin.user.id,
    action: "approve_claim",
    targetTable: "claims",
    targetId: claimId,
    beforeState: { claim_status: claim.status, listing_trust_tier: listing.trust_tier, listing_owner_user_id: listing.owner_user_id },
    afterState: { claim_status: "approved", listing_trust_tier: "claimed", listing_owner_user_id: claim.claimant_user_id, notes },
  })

  // ── Approval email (fire-and-forget) ────────────────────────────────────────
  void (async () => {
    const { data: userData } = await serviceClient.auth.admin.getUserById(
      claim.claimant_user_id!
    )
    const claimantEmail = userData?.user?.email
    if (claimantEmail) {
      await sendEmail({
        to: claimantEmail,
        subject: `Your claim for ${listing.name} has been approved`,
        react: ClaimApprovedEmail({ listingName: listing.name }),
      })
    }
  })()

  return { success: true, claimId, listingId: claim.listing_id }
}
