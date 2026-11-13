'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { isFeatureEnabled } from '@/lib/env'
import { getOwnerSession } from '@/lib/dashboard/guard'
import { buildEntityUrl } from '@/lib/listings/url'
import { revalidateOwnerEditors } from '@/lib/dashboard/revalidateEditors'
import { isUuid } from '@/lib/messaging/rules'

export type SetInboxOpenState = { success: true; open: boolean } | { error: string }

/**
 * The owner's inbox switch for one listing. Writes through the owner's own
 * session, so "listings: owner update" (owner_user_id = auth.uid()) keeps it to
 * their listings. Turning it off stops NEW conversations only.
 */
export async function setInboxOpenAction(listingId: unknown, open: unknown): Promise<SetInboxOpenState> {
  if (!isFeatureEnabled('messaging')) return { error: 'Messaging is not available yet.' }
  if (!isUuid(listingId) || typeof open !== 'boolean') return { error: 'Something went wrong. Please try again.' }

  const owner = await getOwnerSession()
  if (!owner) return { error: 'Please sign in again to change this.' }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('listings')
    .update({ messaging_enabled: open })
    .eq('id', listingId)
    .eq('owner_user_id', owner.user.id)
    .is('deleted_at', null)
    .select('id, slug, status, entity_type, cities(slug)')

  const listing = data?.[0]
  if (error || !listing) {
    console.error(`[messaging] inbox switch save failed for listing ${listingId}`)
    return { error: "We couldn't save that. Please try again." }
  }

  if (listing.status === 'published') {
    const citySlug = (listing.cities as { slug: string } | null)?.slug
    if (citySlug && listing.slug) revalidatePath(buildEntityUrl(listing.entity_type, citySlug, listing.slug))
  }
  revalidateOwnerEditors(listingId)
  revalidatePath('/dashboard/messages', 'layout')

  return { success: true, open }
}
