// =============================================================================
// Password policy — one rule, three callers (founder ask, 2026-09-21)
// =============================================================================
// The Supabase Auth project setting is min length 10 with lowercase, uppercase,
// digit, and symbol all required. lib/auth/password-policy.ts is the local
// mirror; the sign-up page renders a live checklist from it and both password
// actions refuse a weak password before Supabase ever sees it.
//
// What these tests pin down:
//   * checkPassword() agrees with the Supabase rule, including its symbol set
//   * passwordPolicyError() names what is missing, never a bare "too weak"
//   * no caller still carries the old hand-rolled `length < 8` rule
//   * the sign-up and reset pages render the checklist and no static 8-char hint
//   * the checklist encodes state in text, not only colour
//   * no em dash anywhere in the policy copy
// =============================================================================

import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, it, expect } from 'vitest'

import {
  PASSWORD_MIN_LENGTH,
  PASSWORD_POLICY_SUMMARY,
  PASSWORD_RULES,
  PASSWORD_SYMBOLS,
  checkPassword,
  passwordPolicyError,
} from '@/lib/auth/password-policy'

const read = (rel: string) => readFileSync(path.join(process.cwd(), rel), 'utf8')

describe('password policy constants', () => {
  it('matches the Supabase Auth setting: 10 chars, four classes', () => {
    expect(PASSWORD_MIN_LENGTH).toBe(10)
    expect(PASSWORD_RULES.map((r) => r.id)).toEqual([
      'length',
      'lowercase',
      'uppercase',
      'digit',
      'symbol',
    ])
  })

  it('uses the Supabase symbol class verbatim', () => {
    // Supabase's documented list: !@#$%^&*()_+-=[]{};'\:"|<>?,./`~
    expect(PASSWORD_SYMBOLS).toBe('!@#$%^&*()_+-=[]{};\'\\:"|<>?,./`~')
    expect(PASSWORD_SYMBOLS).not.toContain(' ')
  })

  it('carries no em dash in any user-facing copy', () => {
    expect(PASSWORD_POLICY_SUMMARY).not.toContain('\u2014')
    for (const rule of PASSWORD_RULES) expect(rule.label).not.toContain('\u2014')
  })
})

describe('checkPassword()', () => {
  it('passes a password that satisfies every rule', () => {
    const result = checkPassword('Strong-Pass1')
    expect(result.isValid).toBe(true)
    expect(result.passedCount).toBe(5)
  })

  it('rejects the e2e fixture that used to pass the old 8-char rule', () => {
    // 'short' fails everything but lowercase; 'password' fails 4 of 5.
    expect(checkPassword('short').isValid).toBe(false)
    expect(checkPassword('password').passedCount).toBe(1)
  })

  it.each([
    ['length', 'Ab1!short', 'Ab1!longer'],
    ['lowercase', 'ABCDEFGH1!', 'ABCDEFGh1!'],
    ['uppercase', 'abcdefgh1!', 'abcdefgH1!'],
    ['digit', 'Abcdefghi!', 'Abcdefgh1!'],
    ['symbol', 'Abcdefgh12', 'Abcdefgh1!'],
  ])('flags only the %s rule when it alone is missing', (id, failing, passing) => {
    const fail = checkPassword(failing)
    expect(fail.isValid).toBe(false)
    expect(fail.rules.filter((r) => !r.passed).map((r) => r.id)).toEqual([id])
    expect(checkPassword(passing).isValid).toBe(true)
  })

  it('does not count a space or a non-ASCII letter as a symbol', () => {
    expect(checkPassword('Abcdefgh1 ').rules.find((r) => r.id === 'symbol')?.passed).toBe(false)
    expect(checkPassword('Abcdefgh1é').rules.find((r) => r.id === 'symbol')?.passed).toBe(false)
  })

  it('accepts every character in the Supabase symbol class', () => {
    for (const symbol of PASSWORD_SYMBOLS) {
      expect(checkPassword(`Abcdefgh1${symbol}`).isValid).toBe(true)
    }
  })

  it('accepts the shared e2e fixture passwords', () => {
    for (const p of ['A11yTest1234!', 'E2EOwner1234!', 'ValidPassword123!']) {
      expect(checkPassword(p).isValid).toBe(true)
    }
  })
})

describe('passwordPolicyError()', () => {
  it('returns null for a passing password', () => {
    expect(passwordPolicyError('Strong-Pass1')).toBeNull()
  })

  it('names the one missing rule', () => {
    expect(passwordPolicyError('Abcdefgh12')).toBe('Password needs a symbol (like ! @ # $).')
  })

  it('lists several missing rules in plain language', () => {
    expect(passwordPolicyError('abcdefghij')).toBe(
      'Password needs an uppercase letter, a number and a symbol (like ! @ # $).'
    )
  })

  it('keeps the required copy for an empty password', () => {
    expect(passwordPolicyError('')).toBe('Password is required.')
  })
})

describe('callers share the policy (source contract)', () => {
  it.each([
    'lib/actions/auth/signUp.ts',
    'lib/actions/auth/resetPassword.ts',
  ])('%s imports passwordPolicyError and drops the old length < 8 rule', (rel) => {
    const src = read(rel)
    expect(src).toMatch(/from '@\/lib\/auth\/password-policy'/)
    expect(src).toMatch(/passwordPolicyError\(password\)/)
    expect(src).not.toMatch(/length < 8/)
    expect(src).not.toMatch(/at least 8 characters/)
  })

  it('signUp.ts checks the policy before the Supabase call so a weak password never spends the Turnstile token', () => {
    const src = read('lib/actions/auth/signUp.ts')
    const policyAt = src.indexOf('passwordPolicyError(password)')
    const signUpAt = src.indexOf('supabase.auth.signUp(')
    expect(policyAt).toBeGreaterThan(-1)
    expect(signUpAt).toBeGreaterThan(policyAt)
  })

  it('the weak_password translation quotes the shared summary', () => {
    const src = read('lib/auth/sign-up-errors.ts')
    expect(src).toMatch(/PASSWORD_POLICY_SUMMARY/)
    expect(src).not.toMatch(/at least 8 characters/)
  })

  it.each(['app/(auth)/sign-up/page.tsx', 'app/(auth)/reset-password/page.tsx'])(
    '%s renders the live checklist against the shared minimum',
    (rel) => {
      const src = read(rel)
      expect(src).toMatch(/<PasswordChecklist id="password-hint" password=\{password\}/)
      expect(src).toMatch(/minLength=\{PASSWORD_MIN_LENGTH\}/)
      expect(src).not.toMatch(/minLength=\{8\}/)
      expect(src).not.toMatch(/Min\. 8 characters/)
      expect(src).not.toMatch(/at least 8 characters/)
    }
  )

  it('the checklist encodes state in text and a live region, not colour alone', () => {
    const src = read('components/security/PasswordChecklist.tsx')
    expect(src).toMatch(/aria-live="polite"/)
    expect(src).toMatch(/sr-only/)
    expect(src).toMatch(/requirements met/)
    expect(src).toMatch(/data-met=/)
    expect(src).not.toContain('\u2014')
  })
})
