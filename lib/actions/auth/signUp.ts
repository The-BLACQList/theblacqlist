'use server'

import * as Sentry from '@sentry/nextjs'

import { createClient } from '@/lib/supabase/server'
import { getAppUrl } from '@/lib/env'
import { TURNSTILE_ERROR, TURNSTILE_TOKEN_FIELD } from '@/lib/security/turnstile'
import { sendEmail } from '@/lib/email/resend'
import { WelcomeEmail } from '@/lib/email/templates/welcome'
import {
  isSuppressedDuplicate,
  mapSignUpError,
  SIGN_UP_ALREADY_REGISTERED,
  SIGN_UP_UNKNOWN_ERROR,
  type SignUpField,
} from '@/lib/auth/sign-up-errors'

type SignUpState = { error: string; field?: SignUpField } | { success: true; email: string } | null

export async function signUpAction(_prev: SignUpState, formData: FormData): Promise<SignUpState> {
  const email = formData.get('email')?.toString().trim() ?? ''
  const password = formData.get('password')?.toString() ?? ''
  const displayName = formData.get('displayName')?.toString().trim() ?? ''
  const role = formData.get('role')?.toString() ?? 'supporter'
  const onboardingIntent = formData.get('onboardingIntent')?.toString() ?? ''

  if (!displayName) return { error: 'Display name is required.', field: 'displayName' }
  if (displayName.length > 100)
    return {
      error: 'Display name must be 100 characters or fewer.',
      field: 'displayName',
    }
  if (!email) return { error: 'Email is required.', field: 'email' }
  if (!password) return { error: 'Password is required.', field: 'password' }
  if (password.length < 8)
    return {
      error: 'Password must be at least 8 characters.',
      field: 'password',
    }

  const supabase = await createClient()

  const redirectTo = `${getAppUrl()}/auth/callback`

  // Supabase verifies this token itself (Authentication → Attack Protection).
  // We do NOT also call siteverify — a Turnstile token is single-use, so a
  // second verification would fail. Enforcing at the auth endpoint is the whole
  // point: /auth/v1/signup is reachable directly with the public anon key, so a
  // check living only in this server action would protect nothing.
  const captchaToken = formData.get(TURNSTILE_TOKEN_FIELD)?.toString() || undefined

  // `data` is captured, not discarded. It carries the only signal that a
  // duplicate account exists once email confirmation is on — see
  // isSuppressedDuplicate below.
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      captchaToken,
      emailRedirectTo: redirectTo,
      data: {
        display_name: displayName,
        // Maps to DB role on first onboarding step; stored in metadata until
        // schema migration runs and setOnboardingRole can write to user_roles.
        onboarding_role: role,
        onboarding_intent: onboardingIntent,
      },
    },
  })

  if (error) {
    // Captcha stays here: TURNSTILE_ERROR is shared with sign-in and belongs to
    // the security module, not to the sign-up error table.
    if (error.message.toLowerCase().includes('captcha')) {
      return { error: TURNSTILE_ERROR, field: 'general' }
    }

    const mapped = mapSignUpError(error)
    if (mapped) return mapped

    // An unmatched failure is the one nobody can diagnose, so it is the one
    // worth reporting. scrubPii (lib/observability/sentry-scrub.ts) redacts any
    // email or phone substring out of the message before it leaves the process;
    // nothing from the form is attached here.
    Sentry.captureException(new Error(`Unmapped sign-up failure: ${error.message}`), {
      tags: {
        auth_action: 'sign_up',
        auth_error_code: error.code ?? 'none',
        auth_error_status: String(error.status ?? 'none'),
      },
    })
    return SIGN_UP_UNKNOWN_ERROR
  }

  // Email confirmation on ⇒ Supabase answers a duplicate sign-up with a fake
  // success rather than an error, so this check runs on the success path. Without
  // it the person is told to watch an inbox that will never receive anything.
  if (isSuppressedDuplicate(data)) {
    return SIGN_UP_ALREADY_REGISTERED
  }

  void sendEmail({
    to: email,
    subject: 'Welcome to The BLACQList',
    react: WelcomeEmail({ displayName }),
  })

  return { success: true, email }
}
