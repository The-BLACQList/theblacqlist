// =============================================================================
// Sign-up error clarity
// =============================================================================
// Two defects, both of which presented to the founder as "I can't sign up and
// I don't know why":
//
//   1. Every non-captcha failure returned "Something went wrong. Please try
//      again." and logged nothing. The rate-limit case, the policy case, the
//      signups-disabled case and plain transport failure were indistinguishable
//      from the outside AND from Sentry.
//   2. With email confirmation on, Supabase answers a duplicate sign-up with a
//      fake success instead of an error, so the `user_already_exists` branch was
//      unreachable in staging and production. The person was told to check an
//      inbox that would never receive anything.
//
// signUpAction had no unit coverage at all before this file.
// =============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest'

import {
  mapSignUpError,
  isSuppressedDuplicate,
  SIGN_UP_ALREADY_REGISTERED,
  SIGN_UP_UNKNOWN_ERROR,
} from '@/lib/auth/sign-up-errors'

const h = vi.hoisted(() => ({
  signUpResult: {
    data: { user: null as unknown, session: null },
    error: null as { message: string; code?: string; status?: number } | null,
  },
  captured: [] as { message: string; tags: Record<string, unknown> }[],
  emailsSent: [] as { to: string; subject: string }[],
}))

vi.mock('@sentry/nextjs', () => ({
  captureException: (err: Error, ctx?: { tags?: Record<string, unknown> }) => {
    h.captured.push({ message: err.message, tags: ctx?.tags ?? {} })
  },
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: {
      signUp: async () => h.signUpResult,
    },
  }),
}))

vi.mock('@/lib/env', () => ({
  getAppUrl: () => 'https://example.test',
  IS_PRODUCTION: false,
}))

vi.mock('@/lib/email/resend', () => ({
  sendEmail: async ({ to, subject }: { to: string; subject: string }) => {
    h.emailsSent.push({ to, subject })
  },
}))

vi.mock('@/lib/email/templates/welcome', () => ({
  WelcomeEmail: () => null,
}))

const { signUpAction } = await import('@/lib/actions/auth/signUp')

function form(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData()
  fd.set('displayName', 'Test Person')
  fd.set('email', 'someone@example.test')
  fd.set('password', 'Correct-Horse-Battery1')
  for (const [k, v] of Object.entries(overrides)) fd.set(k, v)
  return fd
}

beforeEach(() => {
  h.signUpResult = { data: { user: null, session: null }, error: null }
  h.captured = []
  h.emailsSent = []
})

// -----------------------------------------------------------------------------

describe('mapSignUpError', () => {
  it('matches on the Supabase error code when one is present', () => {
    expect(mapSignUpError({ message: 'anything at all', code: 'over_email_send_rate_limit' }))
      .toMatchObject({ field: 'general' })
    expect(mapSignUpError({ message: 'x', code: 'weak_password' })).toMatchObject({
      field: 'password',
    })
    expect(mapSignUpError({ message: 'x', code: 'signup_disabled' })).toMatchObject({
      field: 'general',
    })
  })

  it('falls back to the message when the SDK sent no code', () => {
    // Older SDK responses and gateway-level failures carry only a message.
    expect(mapSignUpError({ message: 'Email rate limit exceeded' })).toMatchObject({
      field: 'general',
    })
    expect(mapSignUpError({ message: 'Password should be at least 6 characters' })).toMatchObject({
      field: 'password',
    })
    expect(mapSignUpError({ message: 'Unable to validate email address: invalid format' }))
      .toMatchObject({ field: 'email' })
  })

  it('gives the rate limit a message that says to wait, not to retry now', () => {
    const copy = mapSignUpError({ message: 'x', code: 'over_email_send_rate_limit' })!
    expect(copy.error).toMatch(/wait/i)
    // "try again" with no delay is what sent the founder into a retry loop that
    // kept the cap tripped.
    expect(copy.error).not.toBe(SIGN_UP_UNKNOWN_ERROR.error)
  })

  it('returns null for anything it does not recognise, so the caller reports it', () => {
    expect(mapSignUpError({ message: 'socket hang up' })).toBeNull()
    expect(mapSignUpError({ message: '', code: 'something_new_from_supabase' })).toBeNull()
  })

  it('keeps the duplicate wording other files depend on, character for character', () => {
    // app/(auth)/sign-up/page.tsx renders its own "Sign in instead" link only
    // when the message contains `already registered`, and
    // e2e/auth-validation.spec.ts asserts the sentence. Both break silently if
    // this string drifts. The sentence must not carry "Sign in instead" itself:
    // the page appends the link, and the founder read it twice on 2026-09-17.
    expect(SIGN_UP_ALREADY_REGISTERED.error).toBe('That email is already registered.')
    expect(SIGN_UP_ALREADY_REGISTERED.error).toContain('already registered')
    expect(SIGN_UP_ALREADY_REGISTERED.error).not.toContain('Sign in instead')
    expect(SIGN_UP_ALREADY_REGISTERED.field).toBe('email')
  })
})

describe('isSuppressedDuplicate', () => {
  it('reads an empty identities array as the hidden duplicate', () => {
    expect(isSuppressedDuplicate({ user: { identities: [] } })).toBe(true)
  })

  it('leaves a genuine new account alone', () => {
    expect(isSuppressedDuplicate({ user: { identities: [{ id: 'abc' }] } })).toBe(false)
  })

  it('does not guess when identities is missing or null', () => {
    // Confirm-email OFF returns no identities field at all. Treating that as a
    // duplicate would block every local sign-up.
    expect(isSuppressedDuplicate({ user: {} })).toBe(false)
    expect(isSuppressedDuplicate({ user: { identities: null } })).toBe(false)
    expect(isSuppressedDuplicate({ user: null })).toBe(false)
    expect(isSuppressedDuplicate({})).toBe(false)
  })
})

describe('signUpAction', () => {
  it('validates before it ever reaches Supabase', async () => {
    expect(await signUpAction(null, form({ displayName: '' }))).toMatchObject({
      field: 'displayName',
    })
    expect(await signUpAction(null, form({ email: '' }))).toMatchObject({ field: 'email' })
    expect(await signUpAction(null, form({ password: 'short' }))).toMatchObject({
      field: 'password',
    })
    // Old rule was length >= 8; the policy is now 10 + four classes, so a
    // long lowercase-only password is refused here too, with the reason named.
    expect(await signUpAction(null, form({ password: 'correct-horse-battery' }))).toMatchObject({
      field: 'password',
      error: 'Password needs an uppercase letter and a number.',
    })
    expect(h.emailsSent).toHaveLength(0)
  })

  it('names the duplicate account that Supabase hid behind a fake success', async () => {
    h.signUpResult = { data: { user: { identities: [] }, session: null }, error: null }

    const state = await signUpAction(null, form())

    expect(state).toEqual(SIGN_UP_ALREADY_REGISTERED)
    // The old behaviour: a "Check your inbox" panel and a welcome email for an
    // account that already existed.
    expect(h.emailsSent).toHaveLength(0)
  })

  it('succeeds and sends the welcome email for a genuinely new account', async () => {
    h.signUpResult = {
      data: { user: { identities: [{ id: 'identity-1' }] }, session: null },
      error: null,
    }

    const state = await signUpAction(null, form())

    expect(state).toEqual({ success: true, email: 'someone@example.test' })
    expect(h.emailsSent).toHaveLength(1)
  })

  it('passes the captcha failure through untouched', async () => {
    h.signUpResult = {
      data: { user: null, session: null },
      error: { message: 'captcha protection: request disallowed' },
    }

    const state = await signUpAction(null, form())

    expect(state).toMatchObject({ error: 'Verification failed. Please try again.' })
    expect(h.captured).toHaveLength(0)
  })

  it('returns the specific message for a mapped failure and does not page anyone', async () => {
    h.signUpResult = {
      data: { user: null, session: null },
      error: { message: 'whatever', code: 'over_email_send_rate_limit', status: 429 },
    }

    const state = await signUpAction(null, form())

    expect(state).toMatchObject({ field: 'general' })
    expect((state as { error: string }).error).toMatch(/wait/i)
    // A known, explained condition is not an incident.
    expect(h.captured).toHaveLength(0)
  })

  it('reports an unmapped failure to Sentry before falling back', async () => {
    h.signUpResult = {
      data: { user: null, session: null },
      error: { message: 'connect ETIMEDOUT 10.0.0.1:5432', code: 'unexpected_failure', status: 500 },
    }

    const state = await signUpAction(null, form())

    expect(state).toEqual(SIGN_UP_UNKNOWN_ERROR)
    expect(h.captured).toHaveLength(1)
    expect(h.captured[0]!.message).toContain('connect ETIMEDOUT')
    expect(h.captured[0]!.tags).toMatchObject({
      auth_action: 'sign_up',
      auth_error_code: 'unexpected_failure',
      auth_error_status: '500',
    })
  })

  it('never attaches the submitted email or password to the Sentry report', async () => {
    h.signUpResult = {
      data: { user: null, session: null },
      error: { message: 'something unrecognised' },
    }

    await signUpAction(
      null,
      form({ email: 'private@person.test', password: 'Hunter2-Hunter2!' })
    )

    const serialised = JSON.stringify(h.captured)
    expect(serialised).not.toContain('private@person.test')
    expect(serialised).not.toContain('Hunter2-Hunter2!')
  })
})
