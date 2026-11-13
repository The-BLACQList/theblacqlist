'use server'

import { createClient, createServiceClient } from '@/lib/supabase/server'
import { isFeatureEnabled } from '@/lib/env'
import { checkRateLimit } from '@/lib/security/rate-limit'
import { trackServerEvent } from '@/lib/analytics/server'
import { ANALYTICS_EVENTS } from '@/lib/analytics/constants'
import { MESSAGING_UNAVAILABLE_ERROR, SEND_RATE_LIMIT } from '@/lib/messaging/constants'
import { isUuid, normalizeMessageBody, participantRole } from '@/lib/messaging/rules'
import {
  appendMessage,
  getConversationWithOwner,
  isBlocked,
  isMessagingSuspended,
  revalidateConversation,
} from '@/lib/messaging/write'

export type SendMessageState = { success: true; sentAt: string } | { error: string } | null

/**
 * A reply in an existing thread, from either side.
 *
 * The inbox switch does NOT apply here: closing an inbox stops new
 * conversations only. A block stops both sides (the owner unblocks to reply),
 * and a suspension stops the suspended person.
 */
export async function sendMessageAction(_prev: SendMessageState, formData: FormData): Promise<SendMessageState> {
  if (!isFeatureEnabled('messaging')) return { error: MESSAGING_UNAVAILABLE_ERROR }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Please sign in again to reply.' }

  const allowed = await checkRateLimit({
    bucket: 'message_send',
    identifier: `user:${user.id}`,
    ...SEND_RATE_LIMIT,
  })
  if (!allowed) return { error: "You've sent a lot of messages. Try again in a little while." }

  const conversationId = formData.get('conversation_id')?.toString().trim() ?? ''
  if (!isUuid(conversationId)) return { error: 'Conversation not found.' }
  const parsed = normalizeMessageBody(formData.get('body'))
  if (!parsed.ok) return { error: parsed.error }

  const service = createServiceClient()
  const conversation = await getConversationWithOwner(service, conversationId)
  const role = conversation ? participantRole(user.id, conversation, conversation.owner_user_id) : null
  if (!conversation || !role) return { error: 'Conversation not found.' }
  if (conversation.listing_deleted || !conversation.owner_user_id) return { error: MESSAGING_UNAVAILABLE_ERROR }

  try {
    if (await isMessagingSuspended(service, user.id)) return { error: MESSAGING_UNAVAILABLE_ERROR }
    if (await isBlocked(service, conversation.owner_user_id, conversation.customer_user_id)) {
      return {
        error: role === 'owner' ? 'You blocked this customer. Unblock them to reply.' : MESSAGING_UNAVAILABLE_ERROR,
      }
    }
  } catch {
    return { error: 'Something went wrong. Please try again.' }
  }

  const sent = await appendMessage(service, {
    conversationId,
    senderId: user.id,
    senderRole: role,
    body: parsed.body,
  })
  if (!sent.ok) return { error: "We couldn't send that. Please try again." }

  trackServerEvent({
    event_name: ANALYTICS_EVENTS.MESSAGE_SENT,
    entity_id: conversation.listing_id,
    entity_type: 'listing',
    user_id: user.id,
    properties: { sender_role: role, source: 'thread' },
  })

  revalidateConversation(conversationId)
  return { success: true, sentAt: new Date().toISOString() }
}
