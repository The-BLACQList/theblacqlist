"use server"

import { createClient } from "@/lib/supabase/server"
import { getOwnerSession } from "@/lib/dashboard/guard"

export type UpdateMediaAltTextState =
  | { success: true }
  | { error: string }
  | null

export async function updateMediaAltTextAction(
  _prev: UpdateMediaAltTextState,
  formData: FormData
): Promise<UpdateMediaAltTextState> {
  const owner = await getOwnerSession()
  if (!owner) return { error: "You must be signed in to update media." }

  const mediaId = formData.get("media_id")?.toString().trim() ?? ""
  const altText = formData.get("alt_text")?.toString().trim() ?? ""

  if (!mediaId) return { error: "Missing media ID." }
  if (altText.length > 200) return { error: "Alt text must be 200 characters or fewer." }

  const supabase = await createClient()

  const { data: media } = await supabase
    .from("media_attachments")
    .select("id, entity_id")
    .eq("id", mediaId)
    .maybeSingle()

  if (!media) return { error: "Media not found." }

  const { data: ownerCheck } = await supabase
    .from("listings")
    .select("id")
    .eq("id", media.entity_id)
    .eq("owner_user_id", owner.user.id)
    .is("deleted_at", null)
    .maybeSingle()

  if (!ownerCheck) return { error: "You do not have permission to edit this media." }

  const { error } = await supabase
    .from("media_attachments")
    .update({ alt_text: altText || null })
    .eq("id", mediaId)

  if (error) return { error: "Failed to update alt text. Please try again." }

  return { success: true }
}
