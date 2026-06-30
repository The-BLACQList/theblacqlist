'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

function isSafeRedirect(value: string | null): value is string {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//')
}

// Confirms a password-reset (recovery) email link via token_hash + verifyOtp.
// Unlike the PKCE `?code` exchange, verifyOtp needs NO per-browser code_verifier
// cookie, so the link works even when the email is opened on a different device
// than the one that requested the reset. Verification runs only on this POST
// (the Continue button), so email link-scanners that prefetch the URL with a GET
// can't consume the one-time token.
export async function confirmOtpAction(formData: FormData): Promise<void> {
  const tokenHash = formData.get('token_hash')?.toString() ?? ''
  const type = formData.get('type')?.toString() ?? ''
  const nextRaw = formData.get('next')?.toString() ?? null
  const next = isSafeRedirect(nextRaw) ? nextRaw : '/reset-password'

  // Only the recovery (password-reset) flow is wired through here today.
  if (!tokenHash || type !== 'recovery') {
    redirect('/sign-in?error=reset_link_expired')
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.verifyOtp({ type: 'recovery', token_hash: tokenHash })

  if (error) {
    redirect('/sign-in?error=reset_link_expired')
  }

  redirect(next)
}
