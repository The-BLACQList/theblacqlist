// =============================================================================
// Sign-up failure translation
// =============================================================================
// signUpAction used to collapse every non-captcha failure into one string:
// "Something went wrong. Please try again." Six unrelated conditions reached it
// — the project's hourly confirmation-email cap, a redirect URL missing from
// Supabase's allow-list, a password rejected by project policy, sign-ups turned
// off, a malformed address, and plain transport failure. The real message was
// discarded and nothing was logged, so a blocked sign-up could not be diagnosed
// from the outside at all. That is what this module fixes.
//
// It lives outside the action because a 'use server' file may only export async
// functions, and a pure mapper is worth testing directly.
// =============================================================================

export type SignUpField = 'email' | 'password' | 'displayName' | 'general'

export interface SignUpErrorCopy {
  error: string
  field: SignUpField
}

/**
 * The duplicate-account message, quoted in two other places:
 * app/(auth)/sign-up/page.tsx matches the substring `already registered` to
 * decide whether to render its own "Sign in instead" link right after this
 * sentence (so the sentence must NOT end with those words itself, or the
 * person reads them twice), and e2e/auth-validation.spec.ts asserts the
 * sentence. Reword it in one place only and the link silently disappears.
 */
export const SIGN_UP_ALREADY_REGISTERED: SignUpErrorCopy = {
  error: 'That email is already registered.',
  field: 'email',
}

/** Last resort. Reached only when nothing below matched — and it now reports. */
export const SIGN_UP_UNKNOWN_ERROR: SignUpErrorCopy = {
  error: 'Something went wrong. Please try again.',
  field: 'general',
}

/** The shape we need off a Supabase AuthError, without importing the class. */
export interface SupabaseAuthErrorLike {
  message: string
  code?: string
  status?: number
}

/**
 * Supabase returns a stable `code` on recent SDK versions but older responses
 * and some gateway-level failures carry only a message, so each case matches on
 * both. Codes are from Supabase Auth's published error-code list.
 */
const RULES: Array<{
  codes: string[]
  messages: string[]
  copy: SignUpErrorCopy
}> = [
  {
    codes: ['user_already_exists', 'email_exists'],
    messages: ['already registered', 'already been registered', 'user already exists'],
    copy: SIGN_UP_ALREADY_REGISTERED,
  },
  {
    codes: ['over_email_send_rate_limit', 'over_request_rate_limit', 'over_sms_send_rate_limit'],
    messages: ['rate limit', 'too many requests', 'security purposes'],
    copy: {
      // The staging project's default cap is a couple of confirmation emails an
      // hour, so this is the single most likely thing a tester hits.
      error: 'Too many attempts. Wait a few minutes, then try again.',
      field: 'general',
    },
  },
  {
    codes: ['weak_password'],
    messages: ['password should be', 'password is too weak', 'weak password'],
    copy: {
      error: 'That password is too weak. Use at least 8 characters, mixing letters and numbers.',
      field: 'password',
    },
  },
  {
    codes: ['email_address_invalid', 'validation_failed'],
    messages: ['invalid email', 'unable to validate email address'],
    copy: {
      error: 'That email address does not look valid. Check it and try again.',
      field: 'email',
    },
  },
  {
    codes: ['email_address_not_authorized'],
    messages: ['not authorized'],
    copy: {
      error: 'We cannot send to that address right now. Try a different email.',
      field: 'email',
    },
  },
  {
    codes: ['signup_disabled', 'email_provider_disabled'],
    messages: ['signups not allowed', 'signup is disabled', 'email signups are disabled'],
    copy: {
      error: 'New accounts are temporarily closed. Please try again later.',
      field: 'general',
    },
  },
]

/**
 * Translate a Supabase sign-up failure into copy a person can act on.
 *
 * Returns `null` when nothing matched. The caller must report that case before
 * falling back to SIGN_UP_UNKNOWN_ERROR — an unmatched failure is precisely the
 * one nobody can diagnose, so it is the one worth sending to Sentry.
 *
 * Captcha is handled by the caller, which owns TURNSTILE_ERROR.
 */
export function mapSignUpError(error: SupabaseAuthErrorLike): SignUpErrorCopy | null {
  const code = error.code?.toLowerCase() ?? ''
  const message = error.message?.toLowerCase() ?? ''

  for (const rule of RULES) {
    if (code && rule.codes.includes(code)) return rule.copy
    if (message && rule.messages.some((fragment) => message.includes(fragment))) return rule.copy
  }

  return null
}

/**
 * Supabase hides the duplicate-account error whenever email confirmation is on,
 * to stop the form being used to discover who has an account. It returns a
 * success with an obfuscated user instead, whose `identities` array is empty.
 * That empty array is the only signal, and it is why the `user_already_exists`
 * branch above is unreachable in staging and production.
 *
 * Naming the duplicate re-enables that enumeration deliberately — recorded as a
 * founder decision, not an oversight. See docs/blacqlist/ops/decision-log.md.
 */
export function isSuppressedDuplicate(data: {
  user?: { identities?: unknown[] | null } | null
  session?: unknown
}): boolean {
  const identities = data?.user?.identities
  return Array.isArray(identities) && identities.length === 0
}
