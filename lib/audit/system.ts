import { createServiceClient } from '@/lib/supabase/server'
import type { Json } from '@/lib/supabase/types'

/**
 * Writes an audit entry for an action performed by the system rather than an
 * admin user — e.g. a Stripe webhook syncing a subscription. Mirrors
 * `writeAuditLog` in lib/admin/guard.ts but allows a null actor (the
 * admin_user_id column is nullable). Best-effort: never throw into the caller.
 */
export async function writeSystemAuditLog({
  actorUserId = null,
  action,
  targetTable,
  targetId,
  beforeState,
  afterState,
}: {
  /** The affected user (e.g. listing owner from Stripe metadata), or null. */
  actorUserId?: string | null
  action: string
  targetTable: string
  targetId: string | null
  beforeState?: Record<string, unknown> | null
  afterState?: Record<string, unknown> | null
}): Promise<void> {
  try {
    const service = createServiceClient()
    await service.from('admin_audit_log').insert({
      admin_user_id: actorUserId,
      action,
      target_table: targetTable,
      target_id: targetId,
      before_state: (beforeState ?? null) as Json | null,
      after_state: (afterState ?? null) as Json | null,
    })
  } catch (err) {
    // Auditing must never break the operation it records.
    console.error('[writeSystemAuditLog] failed:', action, err)
  }
}
