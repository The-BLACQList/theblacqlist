/**
 * Where the owner Cue's corner button shows (ticket 203): every dashboard
 * page except Upgrade and checkout, where an owner is deciding what to pay.
 * Client-safe and pure, so the tests read it.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isOwnerCueHiddenPath(pathname: string): boolean {
  return pathname === '/dashboard/upgrade' || pathname.startsWith('/dashboard/upgrade/')
}

/** The page open in the dashboard (/dashboard/pages/{id}/...), when there is one. */
export function ownerCuePageId(pathname: string): string | null {
  const id = pathname.match(/^\/dashboard\/pages\/([^/]+)/)?.[1]
  return id && UUID.test(id) ? id : null
}
