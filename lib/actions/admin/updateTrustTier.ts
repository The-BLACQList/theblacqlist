'use server'

import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/server'
import { getAdminSession, writeAuditLog } from '@/lib/admin/guard'
import { MANUAL_TRUST_TIERS, type TrustTier } from '@/lib/constants/listing'

export type UpdateTrustTierState = {
  error?: string
  success?: boolean
}

// Canonical ladder — imported, never redeclared. The previous local list read
// ['unverified','verified','certified']: 'unverified' is not a valid trust_tier
// (the DB CHECK rejected every attempt), and 'unclaimed'/'claimed' were
// unreachable, so there was no manual demotion path at all.
const VALID_TIERS = MANUAL_TRUST_TIERS

export async function updateTrustTier(
  _prev: UpdateTrustTierState,
  formData: FormData
): Promise<UpdateTrustTierState> {
  const session = await getAdminSession()
  if (!session) return { error: 'You must be signed in as an admin.' }

  const listingId = (formData.get('listing_id') as string | null)?.trim() ?? ''
  const newTier = (formData.get('trust_tier') as string | null)?.trim() ?? ''
  const reason = (formData.get('reason') as string | null)?.trim() ?? ''

  if (!listingId) return { error: 'Invalid listing.' }
  if (!VALID_TIERS.includes(newTier as TrustTier)) return { error: 'Invalid trust tier.' }
  if (!reason) return { error: 'A reason is required.' }

  const serviceClient = createServiceClient()

  // Fetch current tier for audit log
  const { data: existing } = await serviceClient
    .from('listings')
    .select('trust_tier, verification_status, verified_at, verified_by')
    .eq('id', listingId)
    .maybeSingle()

  if (!existing) return { error: 'Listing not found.' }

  // Demoting below 'verified' revokes verification: the stamp must not outlive
  // the tier it attests to, or the listing keeps a verified_at/verified_by
  // record while displaying as unclaimed/claimed.
  const isRevocation = newTier === 'unclaimed' || newTier === 'claimed'

  const { error } = await serviceClient
    .from('listings')
    .update({
      trust_tier: newTier,
      ...(isRevocation && {
        verification_status: 'none',
        verified_at: null,
        verified_by: null,
      }),
    })
    .eq('id', listingId)

  if (error) {
    console.error('[updateTrustTier]', error)
    return { error: 'Failed to update trust tier. Please try again.' }
  }

  await writeAuditLog({
    adminUserId: session.user.id,
    action: 'update_trust_tier',
    targetTable: 'listings',
    targetId: listingId,
    beforeState: {
      trust_tier: existing.trust_tier,
      verification_status: existing.verification_status,
      verified_at: existing.verified_at,
    },
    afterState: {
      trust_tier: newTier,
      reason,
      ...(isRevocation && { verification_status: 'none', verified_at: null, revoked: true }),
    },
  })

  revalidatePath(`/admin/entities/${listingId}`)

  return { success: true }
}
