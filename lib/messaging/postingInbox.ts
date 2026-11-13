import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '@/lib/supabase/types'
import { postingInboxOpen, type PostingInboxInput, type PostingKind } from './postings'

type Client = SupabaseClient<Database>

/**
 * Whether a job or event posting takes new conversations (part H). One read
 * path for the listing page (loadListingMessaging) and the start action, so a
 * visitor is never shown a composer the action then refuses.
 *
 * Reads with the SERVICE client: the linked page may be unpublished (its
 * owner's switch still applies), and only two fields are read for an id taken
 * from the posting's own detail row. Throws on a read error; callers fail soft.
 */
export async function readPostingInbox(
  service: Client,
  posting: { id: string; kind: PostingKind; ownerUserId: string | null; messagingEnabled: boolean }
): Promise<{ open: boolean; input: PostingInboxInput }> {
  let linkedId: string | null = null
  let dates: Pick<PostingInboxInput, 'closesAt' | 'startsAt' | 'endsAt'> = {}

  if (posting.kind === 'job') {
    const { data, error } = await service
      .from('listing_details_job')
      .select('hiring_listing_id, closes_at')
      .eq('listing_id', posting.id)
      .maybeSingle()
    if (error) throw error
    linkedId = data?.hiring_listing_id ?? null
    dates = { closesAt: data?.closes_at ?? null }
  } else {
    const { data, error } = await service
      .from('listing_details_event')
      .select('organizer_listing_id, starts_at, ends_at')
      .eq('listing_id', posting.id)
      .maybeSingle()
    if (error) throw error
    linkedId = data?.organizer_listing_id ?? null
    dates = { startsAt: data?.starts_at ?? null, endsAt: data?.ends_at ?? null }
  }

  let linkedPage: PostingInboxInput['linkedPage'] = null
  if (linkedId) {
    const { data: page, error } = await service
      .from('listings')
      .select('id, owner_user_id, messaging_enabled')
      .eq('id', linkedId)
      .is('deleted_at', null)
      .maybeSingle()
    if (error) throw error
    if (page) linkedPage = { id: page.id, ownerUserId: page.owner_user_id, messagingEnabled: page.messaging_enabled === true }
  }

  const input: PostingInboxInput = {
    kind: posting.kind,
    ownerUserId: posting.ownerUserId,
    ownMessagingEnabled: posting.messagingEnabled,
    linkedPage,
    ...dates,
  }
  return { open: postingInboxOpen(input), input }
}
