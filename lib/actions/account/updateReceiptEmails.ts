'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type UpdateReceiptEmailsState = { success: true; on: boolean } | { error: string }

/**
 * Saves the "Email me when a receipt is counted" switch (ticket 165). Writes
 * through the member's own session, so "profiles: authenticated update own"
 * keeps it to their own row.
 */
export async function updateReceiptEmailsAction(on: unknown): Promise<UpdateReceiptEmailsState> {
  if (typeof on !== 'boolean') return { error: 'Something went wrong. Please try again.' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Please sign in again to change this.' }

  const { data, error } = await supabase
    .from('profiles')
    .update({ receipt_counted_emails: on })
    .eq('id', user.id)
    .select('id')

  if (error || !data || data.length === 0) {
    console.error(`[account] receipt email switch save failed for user ${user.id}`)
    return { error: "We couldn't save that. Please try again." }
  }

  revalidatePath('/account/settings')
  return { success: true, on }
}
