import { HIDDEN_PREFIXES } from '@/lib/tour/routes'

// Where the site assistant may appear (ticket 147): public pages only.
//
// Starts from the tour rail's list (admin, the coming-soon gate, sign-in and
// the other auth pages, onboarding) and adds the signed-in and form areas:
// the owner dashboard (which holds checkout), account settings, the add
// wizards, claiming a business, and the join and tester-link pages. A corner
// button over a long form covers the fields a person is typing into.
//
// Prefix matching stops at a path segment, like lib/tour/routes.ts: /join
// hides /join and /join/x, never a future /joinery.

export const ASSISTANT_HIDDEN_PREFIXES = [
  ...HIDDEN_PREFIXES,
  '/dashboard',
  '/account',
  '/add-business',
  '/add-event',
  '/add-job',
  '/claim',
  '/join',
  '/t',
] as const

export function isAssistantHiddenPath(pathname: string): boolean {
  return ASSISTANT_HIDDEN_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  )
}
