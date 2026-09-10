// =============================================================================
// Onboarding role handoff
// =============================================================================
// Sign-up asks "what brings you here?" and stores the answer in user metadata
// (lib/actions/auth/signUp.ts:55). For months nothing read it back: the
// onboarding page fetched cities and nothing else, and OnboardingFlow defaulted
// to 'supporter'. Every owner who signed up landed on the shopper branch and
// was routed to /account/saved instead of /add-business.
//
// Nothing threw. Everything compiled. The wrong screen just rendered — which is
// why half of this file is source-text assertions, the same reason
// tests/tester-tour-render-mode.test.ts uses them. Deleting the lookup in
// page.tsx or the `?? savedRole` fallback in OnboardingFlow breaks no build and
// throws no error; it silently restores the bug.

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

import { normalizeOnboardingRole } from '@/lib/auth/onboardingRole'

const read = (p: string) => readFileSync(path.resolve(process.cwd(), p), 'utf8')

const pageSrc = read('app/onboarding/page.tsx')
const flowSrc = read('app/onboarding/_components/OnboardingFlow.tsx')
const signUpSrc = read('app/(auth)/sign-up/page.tsx')

describe('normalizeOnboardingRole', () => {
  it('keeps supporter as supporter', () => {
    expect(normalizeOnboardingRole('supporter')).toBe('supporter')
  })

  it.each(['owner', 'vendor', 'event_organizer', 'job_poster', 'sponsor'])(
    'collapses %s to owner — five of the six sign-up choices mean owner',
    (value) => {
      expect(normalizeOnboardingRole(value)).toBe('owner')
    }
  )

  it('returns undefined when there is nothing saved, so the caller can fall through', () => {
    expect(normalizeOnboardingRole(undefined)).toBeUndefined()
    expect(normalizeOnboardingRole(null)).toBeUndefined()
    expect(normalizeOnboardingRole('')).toBeUndefined()
    expect(normalizeOnboardingRole('   ')).toBeUndefined()
  })

  it('ignores non-string metadata rather than guessing', () => {
    expect(normalizeOnboardingRole(42)).toBeUndefined()
    expect(normalizeOnboardingRole({ role: 'owner' })).toBeUndefined()
  })

  it('is case-sensitive on supporter — the sign-up form only ever writes lowercase', () => {
    // If this ever needs to change, change the sign-up form too. An accidental
    // 'Supporter' becoming an owner is the safer direction to fail: the owner
    // branch offers "I'll do this later", the supporter branch has no way back.
    expect(normalizeOnboardingRole('Supporter')).toBe('owner')
  })
})

describe('every sign-up role choice maps to exactly one of the two branches', () => {
  it('covers all six values the form offers', () => {
    const values = [...signUpSrc.matchAll(/^\s*value: '([a-z_]+)',$/gm)].map((m) => m[1])
    expect(values).toHaveLength(6)
    expect(values).toContain('supporter')
    for (const value of values) {
      expect(normalizeOnboardingRole(value)).toBe(value === 'supporter' ? 'supporter' : 'owner')
    }
  })
})

describe('app/onboarding/page.tsx reads the saved role', () => {
  it('looks the signed-in user up', () => {
    expect(pageSrc).toMatch(/supabase\.auth\.getUser\(\)/)
  })

  it('normalizes onboarding_role from user metadata', () => {
    expect(pageSrc).toMatch(/normalizeOnboardingRole\(\s*user\?\.user_metadata\?\.onboarding_role\s*\)/)
  })

  it('passes it down to the flow', () => {
    expect(pageSrc).toMatch(/savedRole=\{savedRole\}/)
  })
})

describe('OnboardingFlow falls back to the saved role', () => {
  it('accepts the prop', () => {
    expect(flowSrc).toMatch(/savedRole\?: OnboardingRole/)
  })

  it('prefers ?role= but falls back to savedRole before the supporter default', () => {
    // Order matters: an existing ?role= link must keep working, and 'supporter'
    // stays last so a user with no saved role still gets the shopper branch.
    expect(flowSrc).toMatch(
      /searchParams\.get\('role'\)\s*\?\?\s*savedRole\s*\?\?\s*'supporter'/
    )
  })

  it('still routes owners to the listing path', () => {
    expect(flowSrc).toMatch(/isOwner\s*=\s*roleParam === 'owner'/)
    expect(flowSrc).toContain("handleFinalSubmit('/add-business')")
  })
})
