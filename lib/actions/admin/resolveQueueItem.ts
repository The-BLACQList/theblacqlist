"use server"

import { revalidatePath } from "next/cache"
import { createServiceClient } from "@/lib/supabase/server"
import { getAdminSession, writeAuditLog } from "@/lib/admin/guard"

export type ResolveQueueItemState = { success: true } | { error: string } | null

export async function resolveQueueItemAction(
  _prev: ResolveQueueItemState,
  formData: FormData
): Promise<ResolveQueueItemState> {
  const admin = await getAdminSession()
  if (!admin) return { error: "You do not have permission to perform this action." }

  const queueId = formData.get("queue_id")?.toString().trim() ?? ""
  const decision = formData.get("decision")?.toString().trim()
  const rawPath = formData.get("revalidate_path")?.toString().trim() ?? ""
  const ALLOWED_REVALIDATE_PATHS = [
    "/admin/reports",
    "/admin/queue",
    "/admin/moderation",
    "/admin/reviews",
    "/admin/claims",
    "/admin/corrections",
    "/admin/verifications",
  ]
  const revalidatePage = ALLOWED_REVALIDATE_PATHS.includes(rawPath) ? rawPath : "/admin/reports"

  if (!queueId) return { error: "Missing queue item ID." }
  if (decision !== "resolved" && decision !== "dismissed") {
    return { error: "Decision must be 'resolved' or 'dismissed'." }
  }

  const serviceClient = createServiceClient()

  const { data: item } = await serviceClient
    .from("moderation_queue")
    .select("id, status, queue_type, entity_id")
    .eq("id", queueId)
    .in("status", ["pending", "assigned"])
    .maybeSingle()

  if (!item) return { error: "Queue item not found or already processed." }

  const { error } = await serviceClient
    .from("moderation_queue")
    .update({ status: decision, resolved_at: new Date().toISOString() })
    .eq("id", queueId)

  if (error) return { error: "Failed to update queue item. Please try again." }

  void writeAuditLog({
    adminUserId: admin.user.id,
    action: decision === "resolved" ? "resolve_queue_item" : "dismiss_queue_item",
    targetTable: "moderation_queue",
    targetId: queueId,
    beforeState: { status: item.status, queue_type: item.queue_type },
    afterState: { status: decision },
  })

  revalidatePath(revalidatePage)
  return { success: true }
}
