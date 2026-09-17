'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  defaultNextFor,
  failureRedirectFor,
  parseConfirmLinkType,
} from '@/lib/services/auth/confirmLink'

function isSafeRedirect(value: string | null): value is string {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//')
}

// Confirms a password-reset (recovery) or sign-up (signup/email) link via
// token_hash + verifyOtp. Unlike the PKCE `?code` exchange, verifyOtp needs NO
// per-browser code_verifier cookie, so the link works even when the email is
// opened on a different device than the one that started the flow, or lands on
// a different hostname (a Vercel preview alias vs. its deployment URL).
// Verification runs only on this POST (the Continue button), so email
// link-scanners that prefetch the URL with a GET can't consume the one-time
// token. See lib/services/auth/confirmLink.ts for the type → destination map.
export async function confirmOtpAction(formData: FormData): Promise<void> {
  const tokenHash = formData.get('token_hash')?.toString() ?? ''
  const type = parseConfirmLinkType(formData.get('type')?.toString())
  const nextRaw = formData.get('next')?.toString() ?? null

  if (!tokenHash || !type) {
    redirect(failureRedirectFor(type))
  }

  const next = isSafeRedirect(nextRaw) ? nextRaw : defaultNextFor(type)

  const supabase = await createClient()
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })

  if (error) {
    redirect(failureRedirectFor(type))
  }

  redirect(next)
}
