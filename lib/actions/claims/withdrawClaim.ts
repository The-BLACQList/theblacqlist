'use server'

import { createClient, createServiceClient } from '@/lib/supabase/server'

// ─── Types ────────────────────────────────────────────────────────────────────

export type WithdrawClaimState = { error: string } | { success: true } | null

// ─── Server Action ────────────────────────────────────────────────────────────

export async function withdrawClaimAction(
  _prev: WithdrawClaimState,
  formData: FormData
): Promise<WithdrawClaimState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'You must be signed in to withdraw a claim.' }
  }

  const claimId = formData.get('claim_id')?.toString().trim() ?? ''

  if (!claimId) {
    return { error: 'Invalid claim.' }
  }

  // ── Fetch claim — confirm ownership and status ──────────────────────────────
  const { data: claim } = await supabase
    .from('claims')
    .select('id, claimant_user_id, status')
    .eq('id', claimId)
    .maybeSingle()

  if (!claim || claim.claimant_user_id !== user.id) {
    return { error: 'Claim not found.' }
  }

  if (!['pending', 'under_review'].includes(claim.status)) {
    return {
      error:
        'This claim cannot be withdrawn. Only pending or under-review claims can be withdrawn.',
    }
  }

  // ── Update status ───────────────────────────────────────────────────────────
  const serviceClient = createServiceClient()
  const { error: updateError } = await serviceClient
    .from('claims')
    .update({ status: 'withdrawn' })
    .eq('id', claimId)
    .eq('claimant_user_id', user.id)

  if (updateError) {
    return {
      error: 'Something went wrong withdrawing your claim. Please try again.',
    }
  }

  // Dismiss the open moderation-queue row so the admin queue no longer shows this
  // withdrawn claim as pending. Mirrors approveClaim/rejectClaim's queue resolution;
  // 'dismissed' (not 'resolved') = the claimant withdrew, no admin decision.
  await serviceClient
    .from('moderation_queue')
    .update({ status: 'dismissed', resolved_at: new Date().toISOString() })
    .eq('entity_id', claimId)
    .eq('entity_type', 'claim')
    .in('status', ['pending', 'assigned'])

  return { success: true }
}
