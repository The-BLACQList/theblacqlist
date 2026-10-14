// The last listing page this tab visited, kept so a step row can offer
// "Back to {name}" instead of "Find a listing" (lib/tour/targets.ts,
// `travelButton`).
//
// Same contract as spotlight.ts, for the same reason: the rail mounts in the
// ROOT layout, so nothing here may throw. Storage access is wrapped because
// Safari private mode throws on access, not just on write.
//
// sessionStorage, not localStorage: "the listing you were just on" means this
// tab, this visit. A name remembered from last week is not a trip back.

import { LAST_LISTING_KEY, parseLastListing, type LastListing } from '@/lib/tour/targets'

/** Record the listing on this page, if this is a listing page. */
export function rememberListingOnPage(pathname: string): void {
  if (typeof document === 'undefined') return
  try {
    const mark = document.querySelector<HTMLElement>('[data-tour-listing]')
    const id = mark?.dataset.tourListing
    const name = mark?.dataset.tourListingName
    if (!id || !name) return
    const value: LastListing = { id, name, href: pathname }
    sessionStorage.setItem(LAST_LISTING_KEY, JSON.stringify(value))
  } catch {
    // Non-fatal: the row just offers Discover instead.
  }
}

/** The remembered listing, or null when there is none or storage is blocked. */
export function readLastListing(): LastListing | null {
  try {
    return parseLastListing(sessionStorage.getItem(LAST_LISTING_KEY))
  } catch {
    return null
  }
}
