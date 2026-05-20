'use server'

import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/server'
import { getAdminSession, writeAuditLog } from '@/lib/admin/guard'

export type UpdateTrustTierState = {
  error?: string
  success?: boolean
}

const VALID_TIERS = ['unverified', 'verified', 'certified'] as const
type TrustTier = (typeof VALID_TIERS)[number]

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
    .select('trust_tier')
    .eq('id', listingId)
    .maybeSingle()

  if (!existing) return { error: 'Listing not found.' }

  const { error } = await serviceClient
    .from('listings')
    .update({ trust_tier: newTier })
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
    beforeState: { trust_tier: existing.trust_tier },
    afterState: { trust_tier: newTier, reason },
  })

  revalidatePath(`/admin/entities/${listingId}`)

  return { success: true }
}
