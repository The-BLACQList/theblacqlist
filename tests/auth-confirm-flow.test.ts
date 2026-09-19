import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import {
  defaultNextFor,
  failureRedirectFor,
  parseConfirmLinkType,
} from '@/lib/services/auth/confirmLink'
import {
  ONBOARDING_COMPLETED_KEY,
  hasCompletedOnboarding,
  postSignInDestination,
} from '@/lib/services/auth/onboarding'

/**
 * Tester-week finding (2026-09-17). The founder walked sign-up on a Vercel
 * preview: the confirmation email arrived, the link "expired very quickly" and
 * never reached onboarding, and signing in afterwards went to the dashboard.
 *
 * Two defects, one guard file:
 *
 *  1. The sign-up confirmation used the PKCE `?code` exchange, which needs the
 *     code_verifier cookie the sign-up browser set. Any hop that changes the
 *     browser or the hostname (another device, a mail scanner prefetch, a
 *     preview alias vs. its deployment URL) makes the exchange fail after
 *     Supabase has already consumed the token and confirmed the email. The
 *     password-reset flow was moved to token_hash + verifyOtp for the same
 *     reason (2a69ab6); sign-up now rides the same interstitial.
 *
 *  2. Onboarding was reachable only as the callback's default destination.
 *     A confirmed account whose link failed had no way back to it, and sign-in
 *     always went to /account. Sign-in now routes an un-onboarded account to
 *     /onboarding; onboarding stamps completion in user_metadata.
 *
 * Source-text assertions follow the repo pattern (see
 * form-input-preservation.test.ts): the wiring is the property under test.
 */

const ROOT = path.resolve(__dirname, '..')
const read = (rel: string) => readFileSync(path.join(ROOT, rel), 'utf8')

describe('confirm link type → destination', () => {
  it('accepts recovery, signup and email; rejects anything else', () => {
    expect(parseConfirmLinkType('recovery')).toBe('recovery')
    expect(parseConfirmLinkType('signup')).toBe('signup')
    expect(parseConfirmLinkType('email')).toBe('email')
    expect(parseConfirmLinkType('magiclink')).toBeNull()
    expect(parseConfirmLinkType('')).toBeNull()
    expect(parseConfirmLinkType(undefined)).toBeNull()
  })

  it('sends a confirmed sign-up to onboarding and a recovery to reset-password', () => {
    expect(defaultNextFor('signup')).toBe('/onboarding')
    expect(defaultNextFor('email')).toBe('/onboarding')
    expect(defaultNextFor('recovery')).toBe('/reset-password')
  })

  it('uses a distinct error code per flow so sign-in can say the right thing', () => {
    expect(failureRedirectFor('recovery')).toBe('/sign-in?error=reset_link_expired')
    expect(failureRedirectFor('signup')).toBe('/sign-in?error=confirm_link_expired')
    expect(failureRedirectFor(null)).toBe('/sign-in?error=confirm_link_expired')
  })
})

describe('post sign-in destination', () => {
  const onboarded = { user_metadata: { [ONBOARDING_COMPLETED_KEY]: '2026-09-17T00:00:00.000Z' } }
  const fresh = { user_metadata: {} }

  it('reads the completion stamp from user_metadata, not from roles', () => {
    expect(hasCompletedOnboarding(onboarded)).toBe(true)
    expect(hasCompletedOnboarding(fresh)).toBe(false)
    expect(hasCompletedOnboarding(null)).toBe(false)
    expect(hasCompletedOnboarding({ user_metadata: { [ONBOARDING_COMPLETED_KEY]: '' } })).toBe(
      false
    )
  })

  it('routes an un-onboarded account to /onboarding and an onboarded one to /account', () => {
    expect(postSignInDestination(null, fresh)).toBe('/onboarding')
    expect(postSignInDestination(null, onboarded)).toBe('/account')
  })

  it('lets a safe explicit next win (the E2E fixtures and auth guard depend on it)', () => {
    expect(postSignInDestination('/account/saved', fresh)).toBe('/account/saved')
    expect(postSignInDestination('/dashboard', onboarded)).toBe('/dashboard')
  })

  it('ignores an unsafe next', () => {
    expect(postSignInDestination('https://evil.example', fresh)).toBe('/onboarding')
    expect(postSignInDestination('//evil.example', onboarded)).toBe('/account')
  })
})

describe('wiring', () => {
  it('the callback forwards token_hash links to the /auth/confirm interstitial', () => {
    const src = read('app/auth/callback/route.ts')
    expect(src).toContain("searchParams.has('token_hash')")
    expect(src).toContain("url.pathname = '/auth/confirm'")
  })

  it('the interstitial accepts sign-up links and shows sign-up copy', () => {
    const src = read('app/auth/confirm/page.tsx')
    expect(src).toContain('parseConfirmLinkType')
    expect(src).toContain('Confirm your email')
    expect(src).not.toMatch(/type === 'recovery'\s*$/m)
  })

  it('confirmOtpAction verifies with the parsed type rather than a hard-coded recovery', () => {
    const src = read('lib/actions/auth/confirmOtp.ts')
    expect(src).toContain('parseConfirmLinkType')
    expect(src).toContain('verifyOtp({ type, token_hash: tokenHash })')
    expect(src).not.toContain("verifyOtp({ type: 'recovery'")
  })

  it('sign-in explains a failed confirmation link', () => {
    const src = read('app/(auth)/sign-in/page.tsx')
    expect(src).toContain("error === 'confirm_link_expired'")
  })

  it('sign-in routes through postSignInDestination', () => {
    const src = read('lib/actions/auth/signIn.ts')
    expect(src).toContain('redirect(postSignInDestination(next, data.user))')
  })

  it('setOnboardingRoleAction stamps completion in user_metadata', () => {
    const src = read('lib/actions/account/setOnboardingRole.ts')
    expect(src).toContain('ONBOARDING_COMPLETED_KEY')
    expect(src).toContain('supabase.auth.updateUser')
  })

  it('user-facing copy on the interstitial and sign-in carries no em dashes', () => {
    for (const rel of ['app/auth/confirm/page.tsx', 'app/(auth)/sign-in/page.tsx']) {
      const withoutComments = read(rel)
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '')
      expect(withoutComments, rel).not.toContain('—')
    }
  })
})
