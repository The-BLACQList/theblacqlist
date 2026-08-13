'use server'

import { createClient } from '@/lib/supabase/server'
import { getAppUrl } from '@/lib/env'
import { TURNSTILE_TOKEN_FIELD } from '@/lib/security/turnstile'

export type ForgotPasswordState =
  | { error: string; field?: 'email' | 'general' }
  | { success: true; email: string }
  | null

export async function forgotPasswordAction(
  _prev: ForgotPasswordState,
  formData: FormData
): Promise<ForgotPasswordState> {
  const email = formData.get('email')?.toString().trim() ?? ''
  if (!email) return { error: 'Email is required.', field: 'email' }

  const redirectTo = `${getAppUrl()}/auth/callback?next=/reset-password`

  // Required once project-level CAPTCHA is enabled in Supabase — the recovery
  // endpoint enforces it alongside signup and password sign-in.
  const captchaToken = formData.get(TURNSTILE_TOKEN_FIELD)?.toString() || undefined

  const supabase = await createClient()
  // Supabase silently succeeds even for unknown emails — prevents email enumeration
  await supabase.auth.resetPasswordForEmail(email, { redirectTo, captchaToken })

  return { success: true, email }
}
