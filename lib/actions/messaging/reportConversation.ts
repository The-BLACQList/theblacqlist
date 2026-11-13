'use server'

import { createClient, createServiceClient } from '@/lib/supabase/server'
import { isFeatureEnabled } from '@/lib/env'
import { checkRateLimit } from '@/lib/security/rate-limit'
import { REPORT_RATE_LIMIT } from '@/lib/messaging/constants'
import { isUuid, parseReportInput, participantRole, reportPriority } from '@/lib/messaging/rules'
import { getConversationWithOwner, revalidateConversation } from '@/lib/messaging/write'

export type ReportConversationState = { success: true; blocked: boolean } | { error: string } | null

/**
 * Either side reports the other person, or one of their messages. The report
 * lands in the admin moderation queue as queue_type 'message_report'
 * (/admin/message-reports). The owner side can also block in the same step.
 *
 * Form fields: conversation_id, message_id (optional), reason, note (optional),
 * also_block ('on' when checked; owners only).
 */
export async function reportConversationAction(
  _prev: ReportConversationState,
  formData: FormData
): Promise<ReportConversationState> {
  if (!isFeatureEnabled('messaging')) return { error: 'Not available.' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Please sign in again to send a report.' }

  const allowed = await checkRateLimit({
    bucket: 'message_report',
    identifier: `user:${user.id}`,
    ...REPORT_RATE_LIMIT,
  })
  if (!allowed) return { error: "You've sent a lot of reports today. Try again tomorrow." }

  const conversationId = formData.get('conversation_id')?.toString().trim() ?? ''
  const rawMessageId = formData.get('message_id')?.toString().trim() || null
  if (!isUuid(conversationId)) return { error: 'Conversation not found.' }
  if (rawMessageId && !isUuid(rawMessageId)) return { error: 'Message not found.' }

  const parsed = parseReportInput(formData.get('reason'), formData.get('note'))
  if (!parsed.ok) return { error: parsed.error }

  const service = createServiceClient()
  const conversation = await getConversationWithOwner(service, conversationId)
  const role = conversation ? participantRole(user.id, conversation, conversation.owner_user_id) : null
  if (!conversation || !role) return { error: 'Conversation not found.' }

  const reportedUserId = role === 'owner' ? conversation.customer_user_id : conversation.owner_user_id
  if (!reportedUserId) return { error: 'This business no longer has an owner on the site.' }

  // A reported message must be in this thread and written by the other person.
  if (rawMessageId) {
    const { data: message } = await service
      .from('messages')
      .select('id, sender_user_id')
      .eq('id', rawMessageId)
      .eq('conversation_id', conversationId)
      .maybeSingle()
    if (!message || message.sender_user_id !== reportedUserId) return { error: 'Message not found.' }
  }

  const { error } = await service.from('moderation_queue').insert({
    queue_type: 'message_report',
    entity_id: conversationId,
    entity_type: 'conversation',
    status: 'pending',
    priority: reportPriority(parsed.value.reason),
    submitted_by: user.id,
    details: {
      conversation_id: conversationId,
      message_id: rawMessageId,
      listing_id: conversation.listing_id,
      reported_user_id: reportedUserId,
      reporter_role: role,
      reason: parsed.value.reason,
      note: parsed.value.note,
    },
  })
  if (error) {
    console.error(`[messaging] report insert failed for conversation ${conversationId}`)
    return { error: "We couldn't send your report. Please try again." }
  }

  let blocked = false
  if (role === 'owner' && formData.get('also_block') === 'on') {
    const { error: blockError } = await service
      .from('message_blocks')
      .upsert(
        { owner_user_id: user.id, blocked_user_id: conversation.customer_user_id },
        { onConflict: 'owner_user_id,blocked_user_id', ignoreDuplicates: true }
      )
    blocked = !blockError
    revalidateConversation(conversationId)
  }

  return { success: true, blocked }
}
