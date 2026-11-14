/**
 * Which of the owner's pages is open in the dashboard, read from the address,
 * so the owner Cue (ticket 203) knows what "my page" means. Client-safe and
 * pure, so the tests read it.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** The page open in the dashboard (/dashboard/pages/{id}/...), when there is one. */
export function ownerCuePageId(pathname: string): string | null {
  const id = pathname.match(/^\/dashboard\/pages\/([^/]+)/)?.[1]
  return id && UUID.test(id) ? id : null
}
