'use server'

import { createClient, createServiceClient } from '@/lib/supabase/server'
import { isFeatureEnabled } from '@/lib/env'
import { isUuid, participantRole } from '@/lib/messaging/rules'
import { getConversationWithOwner } from '@/lib/messaging/write'

/**
 * Sets the caller's own read marker on a thread. Called by the thread page
 * once it has rendered an unread thread; the page then refreshes so the nav
 * badge drops. Only ever touches the caller's side.
 */
export async function markConversationReadAction(conversationId: unknown): Promise<{ success: true } | { error: string }> {
  if (!isFeatureEnabled('messaging')) return { error: 'Not available.' }
  if (!isUuid(conversationId)) return { error: 'Conversation not found.' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Please sign in again.' }

  const service = createServiceClient()
  const conversation = await getConversationWithOwner(service, conversationId)
  const role = conversation ? participantRole(user.id, conversation, conversation.owner_user_id) : null
  if (!role) return { error: 'Conversation not found.' }

  const now = new Date().toISOString()
  const { error } = await service
    .from('conversations')
    .update(role === 'customer' ? { customer_last_read_at: now } : { owner_last_read_at: now })
    .eq('id', conversationId)

  if (error) return { error: 'Could not update.' }
  return { success: true }
}
