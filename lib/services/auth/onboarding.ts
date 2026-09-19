import type { User } from '@supabase/supabase-js'

/**
 * Where a person goes after signing in, and how we know whether they have
 * finished onboarding.
 *
 * Onboarding used to be reachable from exactly one place: the default
 * destination of the email-confirmation callback. Anyone whose confirmation
 * link failed (opened on another device, prefetched by a mail scanner, or
 * landing on a different hostname than the one that set the PKCE cookie) had
 * their email confirmed by Supabase but never saw onboarding — and signing in
 * afterwards went straight to /account with no way back. This module gives
 * sign-in a second door.
 *
 * The marker lives in `user_metadata` rather than `user_roles` because the
 * `on_auth_user_created_role` trigger inserts a `supporter` row for every new
 * account at creation time, so the presence of a role row says nothing about
 * whether the person ever saw the onboarding screens.
 */
export const ONBOARDING_COMPLETED_KEY = 'onboarding_completed_at'

export function hasCompletedOnboarding(user: Pick<User, 'user_metadata'> | null | undefined): boolean {
  const value = user?.user_metadata?.[ONBOARDING_COMPLETED_KEY]
  return typeof value === 'string' && value.length > 0
}

function isSafeRedirect(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//')
}

/**
 * An explicit `next` wins — the person was going somewhere and the guard sent
 * them through sign-in on the way. Without one, an account that has not been
 * onboarded goes to /onboarding; everyone else goes to /account.
 */
export function postSignInDestination(
  next: string | null | undefined,
  user: Pick<User, 'user_metadata'> | null | undefined
): string {
  if (isSafeRedirect(next)) return next
  return hasCompletedOnboarding(user) ? '/account' : '/onboarding'
}
