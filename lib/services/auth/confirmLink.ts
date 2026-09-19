/**
 * The Supabase email flows that come through the /auth/confirm interstitial.
 *
 * `recovery` is the password-reset link; `signup` is the confirm-your-email
 * link (Supabase emits `email` for the same purpose from some templates, so
 * both are accepted and treated as sign-up). Both flows use token_hash +
 * verifyOtp rather than the PKCE `?code` exchange, so the link works on a
 * different device, after a mail scanner prefetches it, or on a different
 * hostname than the one that started the flow.
 */
export type ConfirmLinkType = 'recovery' | 'signup' | 'email'

export function parseConfirmLinkType(value: string | null | undefined): ConfirmLinkType | null {
  if (value === 'recovery' || value === 'signup' || value === 'email') return value
  return null
}

export function isSignUpConfirm(type: ConfirmLinkType): boolean {
  return type === 'signup' || type === 'email'
}

/** Where the person lands once the token is verified and no `next` was given. */
export function defaultNextFor(type: ConfirmLinkType): string {
  return type === 'recovery' ? '/reset-password' : '/onboarding'
}

/**
 * Where a failed or malformed link sends the person. The sign-in page turns
 * the `error` code into copy that tells them what to do next.
 */
export function failureRedirectFor(type: ConfirmLinkType | null): string {
  return type === 'recovery'
    ? '/sign-in?error=reset_link_expired'
    : '/sign-in?error=confirm_link_expired'
}
