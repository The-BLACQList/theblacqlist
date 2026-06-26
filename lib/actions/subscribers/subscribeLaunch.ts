'use server'

import { createServiceClient } from '@/lib/supabase/server'

export type SubscribeState = { error: string } | { success: true } | null

// Pragmatic email check — the real validation is the DB unique constraint +
// whatever we send to later. We only guard against obvious garbage here.
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

export async function subscribeLaunchAction(
  _prev: SubscribeState,
  formData: FormData
): Promise<SubscribeState> {
  const email = formData.get('email')?.toString().trim().toLowerCase() ?? ''

  if (!email) return { error: 'Please enter your email address.' }
  if (email.length > 254 || !EMAIL_RE.test(email)) {
    return { error: 'Please enter a valid email address.' }
  }

  // Service-role client: the table has RLS on with no anon insert policy, so the
  // write deliberately goes through the server, never the browser.
  const supabase = createServiceClient()
  const { error } = await supabase
    .from('launch_subscribers')
    .insert({ email, source: 'coming-soon' })

  if (error) {
    // 23505 = unique_violation → already on the list; treat as success.
    if (error.code === '23505') return { success: true }
    return { error: 'Something went wrong. Please try again.' }
  }

  return { success: true }
}
