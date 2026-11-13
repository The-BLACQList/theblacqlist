import 'server-only'

import { revalidatePath } from 'next/cache'
import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '@/lib/supabase/types'
import { CUSTOMER_INBOX_PATH, OWNER_INBOX_PATH } from './constants'
import { messagePreview, type ParticipantRole } from './rules'

// Shared by the messaging server actions. Every function here takes the
// SERVICE client: the actions have already proved who the caller is and what
// they may do, and messaging tables have no write policies for `authenticated`.

type Service = SupabaseClient<Database>

/** The caller's messaging is suspended platform-wide by an admin. */
export async function isMessagingSuspended(service: Service, userId: string): Promise<boolean> {
  const { data, error } = await service
    .from('messaging_suspensions')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle()
  // Fail closed: if we cannot tell, do not send.
  if (error) throw new Error('messaging_suspensions read failed')
  return !!data
}

/** The owner has blocked this customer (covers every listing that owner has). */
export async function isBlocked(service: Service, ownerUserId: string, customerUserId: string): Promise<boolean> {
  const { data, error } = await service
    .from('message_blocks')
    .select('owner_user_id')
    .eq('owner_user_id', ownerUserId)
    .eq('blocked_user_id', customerUserId)
    .maybeSingle()
  if (error) throw new Error('message_blocks read failed')
  return !!data
}

export interface ConversationWithListing {
  id: string
  listing_id: string
  customer_user_id: string
  owner_user_id: string | null
  listing_deleted: boolean
}

/** One conversation plus its listing's owner, read with the service client. */
export async function getConversationWithOwner(
  service: Service,
  conversationId: string
): Promise<ConversationWithListing | null> {
  const { data: conversation } = await service
    .from('conversations')
    .select('id, listing_id, customer_user_id')
    .eq('id', conversationId)
    .maybeSingle()
  if (!conversation) return null

  const { data: listing } = await service
    .from('listings')
    .select('owner_user_id, deleted_at')
    .eq('id', conversation.listing_id)
    .maybeSingle()

  return {
    ...conversation,
    owner_user_id: listing?.owner_user_id ?? null,
    listing_deleted: !listing || !!listing.deleted_at,
  }
}

/**
 * Appends a message and moves the conversation forward. created_at,
 * last_message_at and the sender's read marker are the SAME instant, which is
 * what keeps a person's own message from ever counting as unread to them
 * (rules.ts isConversationUnread, and unread_message_count()).
 */
export async function appendMessage(
  service: Service,
  opts: { conversationId: string; senderId: string; senderRole: ParticipantRole; body: string }
): Promise<{ ok: true; messageId: string } | { ok: false }> {
  const now = new Date().toISOString()

  const { data: message, error } = await service
    .from('messages')
    .insert({
      conversation_id: opts.conversationId,
      sender_user_id: opts.senderId,
      body: opts.body,
      created_at: now,
    })
    .select('id')
    .single()
  if (error || !message) return { ok: false }

  const { error: bumpError } = await service
    .from('conversations')
    .update({
      last_message_at: now,
      last_message_preview: messagePreview(opts.body),
      ...(opts.senderRole === 'customer' ? { customer_last_read_at: now } : { owner_last_read_at: now }),
    })
    .eq('id', opts.conversationId)
  // The message is saved; a failed bump only mis-orders the inbox list.
  if (bumpError) console.error(`[messaging] conversation bump failed for ${opts.conversationId}`)

  return { ok: true, messageId: message.id }
}

/** Both sides' inbox pages and the thread itself. Layout badges refresh with them. */
export function revalidateConversation(conversationId: string): void {
  revalidatePath(CUSTOMER_INBOX_PATH)
  revalidatePath(`${CUSTOMER_INBOX_PATH}/${conversationId}`)
  revalidatePath(OWNER_INBOX_PATH)
  revalidatePath(`${OWNER_INBOX_PATH}/${conversationId}`)
}
