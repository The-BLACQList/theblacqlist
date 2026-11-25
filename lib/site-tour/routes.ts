import { isAssistantHiddenPath } from '@/lib/assistant/routes'

// Where the site tour may show (ticket 280): the same public pages as the site
// assistant. Never over admin, sign-in, onboarding, the dashboard, account, the
// add and claim forms, or a tester link.
export function isSiteTourHiddenPath(pathname: string): boolean {
  return isAssistantHiddenPath(pathname)
}

/** The coming-soon gate is not a visit: it must not use up the first one. */
export function countsAsVisit(pathname: string): boolean {
  return pathname !== '/coming-soon' && !pathname.startsWith('/admin')
}
