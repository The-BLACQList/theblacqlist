// =============================================================================
// Password policy — the single source for sign-up and reset-password
// =============================================================================
// Mirrors the Supabase Auth setting (Authentication → Sign In / Providers →
// Email → Password requirements): minimum length 10, and at least one
// character from each of lowercase, uppercase, digits, and symbols. The symbol
// set below is Supabase's own list, copied verbatim, so a password this file
// accepts is a password Supabase accepts and vice versa.
//
// Three callers share it, and they must never drift:
//   * app/(auth)/sign-up/page.tsx renders the live checklist from RULES
//   * lib/actions/auth/signUp.ts refuses a weak password BEFORE calling
//     Supabase, so a rejected password never spends the single-use Turnstile
//     token (see PR #138 for why that matters)
//   * lib/actions/auth/resetPassword.ts does the same before updateUser()
//
// If the Supabase setting changes, change it here in the same PR.
// =============================================================================

export const PASSWORD_MIN_LENGTH = 10

/** Supabase's symbol class, verbatim. A space is not a symbol. */
export const PASSWORD_SYMBOLS = '!@#$%^&*()_+-=[]{};\'\\:"|<>?,./`~'

export type PasswordRuleId = 'length' | 'lowercase' | 'uppercase' | 'digit' | 'symbol'

export interface PasswordRule {
  id: PasswordRuleId
  /** Short, plain-language label shown in the checklist. */
  label: string
  test: (password: string) => boolean
}

export const PASSWORD_RULES: readonly PasswordRule[] = [
  {
    id: 'length',
    label: `At least ${PASSWORD_MIN_LENGTH} characters`,
    test: (p) => p.length >= PASSWORD_MIN_LENGTH,
  },
  { id: 'lowercase', label: 'A lowercase letter', test: (p) => /[a-z]/.test(p) },
  { id: 'uppercase', label: 'An uppercase letter', test: (p) => /[A-Z]/.test(p) },
  { id: 'digit', label: 'A number', test: (p) => /[0-9]/.test(p) },
  {
    id: 'symbol',
    label: 'A symbol (like ! @ # $)',
    test: (p) => [...p].some((c) => PASSWORD_SYMBOLS.includes(c)),
  },
]

/** One-line summary for hints and server error copy. No em dashes. */
export const PASSWORD_POLICY_SUMMARY = `At least ${PASSWORD_MIN_LENGTH} characters with an uppercase letter, a lowercase letter, a number and a symbol.`

export interface PasswordRuleResult {
  id: PasswordRuleId
  label: string
  passed: boolean
}

export interface PasswordCheck {
  rules: PasswordRuleResult[]
  /** True only when every rule passes. */
  isValid: boolean
  /** Count of rules currently satisfied, for the live progress line. */
  passedCount: number
}

/** Pure: same input, same output. Safe on the client and the server. */
export function checkPassword(password: string): PasswordCheck {
  const rules = PASSWORD_RULES.map((rule) => ({
    id: rule.id,
    label: rule.label,
    passed: rule.test(password),
  }))
  const passedCount = rules.filter((r) => r.passed).length
  return { rules, isValid: passedCount === rules.length, passedCount }
}

/**
 * Server-side copy for a password that fails the policy, or null when it
 * passes. Names what is missing so the user can fix it without guessing.
 */
export function passwordPolicyError(password: string): string | null {
  if (!password) return 'Password is required.'
  const { rules, isValid } = checkPassword(password)
  if (isValid) return null
  const missing = rules.filter((r) => !r.passed).map((r) => r.label.toLowerCase())
  if (missing.length === 1) return `Password needs ${missing[0]}.`
  const last = missing.pop()
  return `Password needs ${missing.join(', ')} and ${last}.`
}
