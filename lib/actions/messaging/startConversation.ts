'use server'

import { createClient, createServiceClient } from '@/lib/supabase/server'
import { isFeatureEnabled } from '@/lib/env'
import { checkRateLimit } from '@/lib/security/rate-limit'
import { TURNSTILE_ERROR, verifyTurnstileFormData } from '@/lib/security/turnstile'
import { trackServerEvent } from '@/lib/analytics/server'
import { ANALYTICS_EVENTS } from '@/lib/analytics/constants'
import { MESSAGING_UNAVAILABLE_ERROR, START_RATE_LIMIT } from '@/lib/messaging/constants'
import { isUuid, normalizeMessageBody } from '@/lib/messaging/rules'
import { postingKind } from '@/lib/messaging/postings'
import { readPostingInbox } from '@/lib/messaging/postingInbox'
import { appendMessage, isBlocked, isMessagingSuspended, revalidateConversation } from '@/lib/messaging/write'

export type StartConversationState = { success: true; conversationId: string } | { error: string } | null

/**
 * A customer's first message to a business, from the listing page composer.
 *
 * Rules (decision 2026-11-13):
 *   - signed in; never the listing's owner
 *   - the listing is published, not deleted, and claimed
 *   - the inbox is open (listings.messaging_enabled) for a NEW conversation.
 *     If this customer already has a thread with this listing, the message is
 *     appended to it instead, and the inbox switch does not apply (existing
 *     threads stay open).
 *   - not blocked by the owner, not suspended. Both answer with the same
 *     neutral error as a closed inbox, so a block is never revealed.
 *   - Turnstile, and 5 per hour per account.
 *   - "Send as" (owner-experience round 2): an optional as_listing_id names one
 *     of the sender's own published pages. It is stored on a NEW thread only
 *     (customer_listing_id); an existing thread keeps the identity it started
 *     with. Blocks and suspensions stay per person, whatever page they use.
 *   - Job and event postings (part H): a new thread needs the posting's
 *     effective inbox (readPostingInbox: the linked page's switch, else the
 *     posting's own) and a role that has not closed / an event that is not
 *     over. "Send as" is ignored on jobs: people apply, not pages.
 */
export async function startConversationAction(
  _prev: StartConversationState,
  formData: FormData
): Promise<StartConversationState> {
  if (!isFeatureEnabled('messaging')) return { error: MESSAGING_UNAVAILABLE_ERROR }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Please sign in to send a message.' }

  if (!(await verifyTurnstileFormData(formData))) return { error: TURNSTILE_ERROR }

  const allowed = await checkRateLimit({
    bucket: 'message_start',
    identifier: `user:${user.id}`,
    ...START_RATE_LIMIT,
  })
  if (!allowed) return { error: "You've sent a lot of new messages. Try again in an hour." }

  const listingId = formData.get('listing_id')?.toString().trim() ?? ''
  if (!isUuid(listingId)) return { error: 'Missing listing.' }
  const parsed = normalizeMessageBody(formData.get('body'))
  if (!parsed.ok) return { error: parsed.error }
  const requestedAsListingId = formData.get('as_listing_id')?.toString().trim() || null
  if (requestedAsListingId && (!isUuid(requestedAsListingId) || requestedAsListingId === listingId)) {
    return { error: 'Pick one of your pages to send as.' }
  }

  const service = createServiceClient()

  const { data: listing } = await service
    .from('listings')
    .select('id, owner_user_id, status, deleted_at, messaging_enabled, entity_type')
    .eq('id', listingId)
    .maybeSingle()

  if (!listing || listing.deleted_at || listing.status !== 'published' || !listing.owner_user_id) {
    return { error: MESSAGING_UNAVAILABLE_ERROR }
  }
  if (listing.owner_user_id === user.id) return { error: "You can't message your own business." }
  const kind = postingKind(listing.entity_type)
  const asListingId = kind === 'job' ? null : requestedAsListingId

  try {
    if (
      (await isMessagingSuspended(service, user.id)) ||
      (await isBlocked(service, listing.owner_user_id, user.id))
    ) {
      return { error: MESSAGING_UNAVAILABLE_ERROR }
    }
  } catch {
    return { error: 'Something went wrong. Please try again.' }
  }

  const { data: existing } = await service
    .from('conversations')
    .select('id')
    .eq('listing_id', listingId)
    .eq('customer_user_id', user.id)
    .maybeSingle()

  let conversationId = existing?.id ?? null
  let created = false

  if (!conversationId) {
    let inboxOpen = listing.messaging_enabled === true
    if (kind) {
      try {
        const posting = await readPostingInbox(service, {
          id: listing.id,
          kind,
          ownerUserId: listing.owner_user_id,
          messagingEnabled: inboxOpen,
        })
        inboxOpen = posting.open
      } catch {
        return { error: 'Something went wrong. Please try again.' }
      }
    }
    if (!inboxOpen) return { error: MESSAGING_UNAVAILABLE_ERROR }

    if (asListingId) {
      // Only the sender's own live page: the receiver sees its name and logo.
      const { data: asPage } = await service
        .from('listings')
        .select('id')
        .eq('id', asListingId)
        .eq('owner_user_id', user.id)
        .eq('status', 'published')
        .is('deleted_at', null)
        .maybeSingle()
      if (!asPage) return { error: 'Pick one of your pages to send as.' }
    }

    const { data: inserted, error } = await service
      .from('conversations')
      .insert({ listing_id: listingId, customer_user_id: user.id, customer_listing_id: asListingId })
      .select('id')
      .single()

    if (inserted) {
      conversationId = inserted.id
      created = true
    } else if (error?.code === '23505') {
      // Two submits raced; the other one created the thread. Use it.
      const { data: raced } = await service
        .from('conversations')
        .select('id')
        .eq('listing_id', listingId)
        .eq('customer_user_id', user.id)
        .maybeSingle()
      conversationId = raced?.id ?? null
    }
    if (!conversationId) return { error: "We couldn't send that. Please try again." }
  }

  const sent = await appendMessage(service, {
    conversationId,
    senderId: user.id,
    senderRole: 'customer',
    body: parsed.body,
  })
  if (!sent.ok) return { error: "We couldn't send that. Please try again." }

  trackServerEvent({
    event_name: created ? ANALYTICS_EVENTS.MESSAGE_CONVERSATION_STARTED : ANALYTICS_EVENTS.MESSAGE_SENT,
    entity_id: listingId,
    entity_type: 'listing',
    user_id: user.id,
    properties: {
      sender_role: 'customer',
      source: 'listing_composer',
      as_page: created && !!asListingId,
      posting: kind ?? 'none',
    },
  })

  revalidateConversation(conversationId)
  return { success: true, conversationId }
}
