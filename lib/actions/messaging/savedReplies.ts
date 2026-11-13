'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { isFeatureEnabled } from '@/lib/env'
import { OWNER_INBOX_PATH, SAVED_REPLY_LIMIT, type SavedReplyKind } from '@/lib/messaging/constants'
import { isUuid, parseSavedReplyInput } from '@/lib/messaging/rules'

export type SavedReply = { id: string; title: string; body: string; kind: SavedReplyKind }
export type SavedReplyState = { success: true; reply: SavedReply } | { error: string }
export type DeleteSavedReplyState = { success: true } | { error: string }

/**
 * An owner saves a reply to reuse (part H). From Inbox settings, or "Save as
 * reply" under the reply box. The table is SELECT-only for clients, so the
 * write runs on the service role, always as the signed-in user, and the cap
 * (SAVED_REPLY_LIMIT per owner) is checked here.
 */
export async function createSavedReplyAction(input: {
  title: unknown
  body: unknown
  kind: unknown
}): Promise<SavedReplyState> {
  if (!isFeatureEnabled('messaging')) return { error: 'Not available.' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Please sign in again.' }

  const parsed = parseSavedReplyInput(input?.title, input?.body, input?.kind)
  if (!parsed.ok) return { error: parsed.error }

  const service = createServiceClient()
  const { count, error: countError } = await service
    .from('message_saved_replies')
    .select('id', { count: 'exact', head: true })
    .eq('owner_user_id', user.id)
  if (countError) return { error: "We couldn't save that reply. Please try again." }
  if ((count ?? 0) >= SAVED_REPLY_LIMIT) {
    return { error: `You can save up to ${SAVED_REPLY_LIMIT} replies. Delete one to add another.` }
  }

  const { data, error } = await service
    .from('message_saved_replies')
    .insert({ owner_user_id: user.id, ...parsed.value })
    .select('id, title, body, kind')
    .single()
  if (error || !data) return { error: "We couldn't save that reply. Please try again." }

  revalidatePath(OWNER_INBOX_PATH, 'layout')
  return { success: true, reply: { ...data, kind: data.kind as SavedReplyKind } }
}

/** Deletes one of the caller's own saved replies. */
export async function deleteSavedReplyAction(id: unknown): Promise<DeleteSavedReplyState> {
  if (!isFeatureEnabled('messaging')) return { error: 'Not available.' }
  if (!isUuid(id)) return { error: 'Reply not found.' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Please sign in again.' }

  // Scoped to the caller's own rows; there is no other way to reach one.
  const { error } = await createServiceClient()
    .from('message_saved_replies')
    .delete()
    .eq('id', id)
    .eq('owner_user_id', user.id)
  if (error) return { error: "We couldn't delete that reply. Please try again." }

  revalidatePath(OWNER_INBOX_PATH, 'layout')
  return { success: true }
}
