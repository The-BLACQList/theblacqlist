// Where the Tester Tour rail is allowed to appear.
//
// Extracted from TourRail.tsx so the policy is a plain, testable function
// rather than a closure inside a client component: which routes hide the rail
// is a product decision, and it is the kind that breaks silently — a rail
// floating over the admin console or the coming-soon gate looks fine in code
// review and wrong in a screenshot.
//
// Matching is by PREFIX, deliberately unlike ChromeGate's exact equality
// (components/layout/chrome-gate.tsx): /admin has children, and the rail must
// not float over any of them. Prefix matching also has to stop at a path
// SEGMENT — `/admin` hides /admin and /admin/claims, but must not hide a
// future /administrators, which a bare startsWith would swallow.

export const HIDDEN_PREFIXES = [
  '/admin',
  '/coming-soon',
  '/auth',
  '/sign-in',
  '/sign-up',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/onboarding',
] as const

export function isHiddenPath(pathname: string): boolean {
  return HIDDEN_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  )
}

// Hidden for the RAIL only. The tour never walks the add-listing wizard, and a
// 22rem panel over a phone form hides the inputs a tester is typing into. The
// "Report a problem" pill deliberately stays here: a tester filling in a long
// form is exactly who hits a problem, and the pill collapses to a small
// "Report" on phones, so reporting stays one tap away.
export const RAIL_ONLY_HIDDEN_PREFIXES = ['/add-business'] as const

export function isRailHiddenPath(pathname: string): boolean {
  return RAIL_ONLY_HIDDEN_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  )
}
