/**
 * The sign-up form offers six role choices (app/(auth)/sign-up/page.tsx:13-49);
 * five of them mean "owner" — owner, vendor, event organizer, job poster,
 * sponsor. signUpAction stores the *granular* value in user metadata
 * (lib/actions/auth/signUp.ts:55), but the onboarding flow branches only two
 * ways, so everything that isn't `supporter` collapses to `owner` here.
 *
 * This lives in its own module so it can be unit-tested. The bug it fixes was
 * silent for months: `onboarding_role` was written at sign-up and read nowhere,
 * so every new owner landed on the shopper branch and was routed to
 * /account/saved instead of /add-business. Nothing threw; the wrong screen just
 * rendered.
 */
export type OnboardingRole = 'owner' | 'supporter'

export function normalizeOnboardingRole(value: unknown): OnboardingRole | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  if (trimmed === '') return undefined
  return trimmed === 'supporter' ? 'supporter' : 'owner'
}
