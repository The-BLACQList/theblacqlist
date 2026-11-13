'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { isFeatureEnabled } from '@/lib/env'
import { OWNER_INBOX_PATH } from '@/lib/messaging/constants'
import { isUuid } from '@/lib/messaging/rules'
import { getConversationWithOwner, revalidateConversation } from '@/lib/messaging/write'

export type BlockState = { success: true; blocked: boolean } | { error: string }

/**
 * An owner blocks the customer in one of their threads. The block covers every
 * listing that owner has. The customer is never told: they see the same
 * "You can't message this business" as a closed inbox.
 */
export async function blockUserAction(conversationId: unknown): Promise<BlockState> {
  if (!isFeatureEnabled('messaging')) return { error: 'Not available.' }
  if (!isUuid(conversationId)) return { error: 'Conversation not found.' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Please sign in again.' }

  const service = createServiceClient()
  const conversation = await getConversationWithOwner(service, conversationId)
  // Only the listing's owner can block from a thread.
  if (!conversation || conversation.owner_user_id !== user.id) return { error: 'Conversation not found.' }

  const { error } = await service
    .from('message_blocks')
    .upsert(
      { owner_user_id: user.id, blocked_user_id: conversation.customer_user_id },
      { onConflict: 'owner_user_id,blocked_user_id', ignoreDuplicates: true }
    )
  if (error) return { error: "We couldn't block this customer. Please try again." }

  revalidateConversation(conversationId)
  return { success: true, blocked: true }
}

/** Lifts a block. Takes the customer's id because the dashboard list has no thread. */
export async function unblockUserAction(blockedUserId: unknown): Promise<BlockState> {
  if (!isFeatureEnabled('messaging')) return { error: 'Not available.' }
  if (!isUuid(blockedUserId)) return { error: 'Customer not found.' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Please sign in again.' }

  // Scoped to the caller's own blocks; there is no other way to reach a row.
  const { error } = await createServiceClient()
    .from('message_blocks')
    .delete()
    .eq('owner_user_id', user.id)
    .eq('blocked_user_id', blockedUserId)
  if (error) return { error: "We couldn't unblock this customer. Please try again." }

  revalidatePath(OWNER_INBOX_PATH, 'layout')
  return { success: true, blocked: false }
}
