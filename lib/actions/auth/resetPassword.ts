'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { passwordPolicyError } from '@/lib/auth/password-policy'

export type ResetPasswordState =
  | { error: string; field?: 'password' | 'confirmPassword' | 'general' }
  | { success: true }
  | null

export async function resetPasswordAction(
  _prev: ResetPasswordState,
  formData: FormData
): Promise<ResetPasswordState> {
  const password = formData.get('password')?.toString() ?? ''
  const confirmPassword = formData.get('confirmPassword')?.toString() ?? ''

  // Same rule as sign-up and the Supabase Auth setting, checked before
  // updateUser() so a weak password gets a named reason instead of the
  // generic "Something went wrong" below.
  const passwordError = passwordPolicyError(password)
  if (passwordError) return { error: passwordError, field: 'password' }
  if (password !== confirmPassword)
    return { error: 'Passwords do not match.', field: 'confirmPassword' }

  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({ password })

  if (error) {
    if (
      error.message.toLowerCase().includes('session') ||
      error.message.toLowerCase().includes('token') ||
      error.message.toLowerCase().includes('expired')
    ) {
      return {
        error: 'Your reset link has expired. Please request a new one.',
        field: 'general',
      }
    }
    return { error: 'Something went wrong. Please try again.', field: 'general' }
  }

  redirect('/account')
}
