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
