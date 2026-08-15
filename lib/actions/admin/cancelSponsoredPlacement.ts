'use server'

import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/server'
import { getAdminSession } from '@/lib/admin/guard'

export type CancelSponsoredPlacementState = {
  error?: string
  success?: boolean
}

function isValidUUID(s: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)
}

/**
 * Ends a placement early.
 *
 * 'canceled' is a stored status rather than a date edit on purpose. Expiry is
 * derived from `ends_at` (lib/listings/sponsoredStatus.ts), so a cancellation
 * expressed by rewriting `ends_at` would be indistinguishable afterwards from a
 * placement that simply ran its course — and the sponsor's paid window would be
 * lost from the record. Cancellation is a decision someone made; it gets its own
 * state, and the original dates stay intact as the evidence of what was sold.
 *
 * It is also why 'canceled' outranks every date in the derivation: the delivery
 * query (lib/listings/query.ts) serves only 'active' and 'scheduled', so writing
 * this status stops delivery immediately regardless of what the dates say.
 */
export async function cancelSponsoredPlacement(
  _prev: CancelSponsoredPlacementState,
  formData: FormData
): Promise<CancelSponsoredPlacementState> {
  const session = await getAdminSession()
  if (!session) return { error: 'Unauthorized' }

  const id = (formData.get('id') as string | null) ?? ''
  if (!id || !isValidUUID(id)) return { error: 'A placement is required' }

  const supabase = createServiceClient()

  // Guarded so a cancel cannot resurrect or rewrite a placement that already
  // ended, and so a double-submit is a no-op rather than a second write.
  const { data, error } = await supabase
    .from('sponsored_placements')
    .update({ status: 'canceled' })
    .eq('id', id)
    .in('status', ['active', 'scheduled'])
    .select('id')

  if (error) {
    console.error('[cancelSponsoredPlacement]', error)
    return { error: 'Failed to cancel placement. Please try again.' }
  }

  if (!data || data.length === 0) {
    return { error: 'That placement is no longer cancelable.' }
  }

  revalidatePath('/admin/sponsored')
  revalidatePath('/discover')

  return { success: true }
}
