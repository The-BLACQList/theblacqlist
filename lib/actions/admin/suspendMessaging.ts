'use server'

import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/server'
import { getAdminSession, writeAuditLog } from '@/lib/admin/guard'
import { isUuid } from '@/lib/messaging/rules'

export type SuspendMessagingState = { success: true } | { error: string } | null

const REPORTS_PATH = '/admin/reports/messages'

/**
 * Suspends the reported user's messaging platform-wide and resolves the report.
 * The user id comes from the queue item, never from the form, so an admin can
 * only suspend someone who was actually reported.
 */
export async function suspendMessagingAction(
  _prev: SuspendMessagingState,
  formData: FormData
): Promise<SuspendMessagingState> {
  const admin = await getAdminSession()
  if (!admin) return { error: 'You do not have permission to perform this action.' }

  const queueId = formData.get('queue_id')?.toString().trim() ?? ''
  if (!isUuid(queueId)) return { error: 'Missing report.' }

  const service = createServiceClient()
  const { data: item } = await service
    .from('moderation_queue')
    .select('id, status, queue_type, details')
    .eq('id', queueId)
    .eq('queue_type', 'message_report')
    .maybeSingle()
  if (!item) return { error: 'Report not found.' }

  const details = (item.details ?? {}) as { reported_user_id?: unknown }
  const userId = details.reported_user_id
  if (!isUuid(userId)) return { error: 'This report does not name a user.' }

  const { error } = await service
    .from('messaging_suspensions')
    .upsert(
      { user_id: userId, suspended_by: admin.user.id, queue_item_id: queueId },
      { onConflict: 'user_id', ignoreDuplicates: true }
    )
  if (error) return { error: "Couldn't suspend messaging. Please try again." }

  if (item.status === 'pending' || item.status === 'assigned') {
    await service
      .from('moderation_queue')
      .update({ status: 'resolved', resolved_at: new Date().toISOString() })
      .eq('id', queueId)
  }

  void writeAuditLog({
    adminUserId: admin.user.id,
    action: 'suspend_messaging',
    targetTable: 'messaging_suspensions',
    targetId: userId,
    beforeState: { queue_item_id: queueId, queue_status: item.status },
    afterState: { suspended: true, queue_status: 'resolved' },
  })

  revalidatePath(REPORTS_PATH)
  return { success: true }
}

/** Lifts a messaging suspension. */
export async function liftMessagingSuspensionAction(
  _prev: SuspendMessagingState,
  formData: FormData
): Promise<SuspendMessagingState> {
  const admin = await getAdminSession()
  if (!admin) return { error: 'You do not have permission to perform this action.' }

  const userId = formData.get('user_id')?.toString().trim() ?? ''
  if (!isUuid(userId)) return { error: 'Missing user.' }

  const service = createServiceClient()
  const { data: removed, error } = await service
    .from('messaging_suspensions')
    .delete()
    .eq('user_id', userId)
    .select('user_id, suspended_at, queue_item_id')
  if (error) return { error: "Couldn't lift the suspension. Please try again." }
  const row = removed?.[0]
  if (!row) return { error: 'This user is not suspended.' }

  void writeAuditLog({
    adminUserId: admin.user.id,
    action: 'lift_messaging_suspension',
    targetTable: 'messaging_suspensions',
    targetId: userId,
    beforeState: { suspended_at: row.suspended_at, queue_item_id: row.queue_item_id },
    afterState: { suspended: false },
  })

  revalidatePath(REPORTS_PATH)
  return { success: true }
}
