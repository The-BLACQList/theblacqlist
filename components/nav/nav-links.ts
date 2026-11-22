import { CUSTOMER_INBOX_PATH, OWNER_INBOX_PATH } from '@/lib/messaging/constants'

export interface NavLink {
  label: string
  href: string
}

/** The header and mobile menu links, in order. */
export const MAIN_NAV_LINKS: NavLink[] = [
  // [Decision — founder, 2026-11-12: Home first in the menu bar.]
  { label: 'Home', href: '/' },
  { label: 'Discover', href: '/discover' },
  { label: 'Map', href: '/map' },
  { label: 'The Collective', href: '/flow-map' },
  { label: 'For Business', href: '/for-business' },
]

/**
 * Signed-in visitors get Saved beside My Account, in the header and the mobile
 * menu.
 * [Decision — founder, 2026-10-15 (simplicity M1): tester said saved places
 * had "nothing [that] navigates you back to them." Founder placed it on the
 * account side, not in the main links.]
 */
export const SAVED_LINK: NavLink = { label: 'Saved', href: '/account/saved' }

/**
 * What the header's My Account menu holds (ticket 252, founder 2026-11-21:
 * "have My Business as a dropdown under My account"). Owners get My Business
 * first. Messages follows the same inbox rule as the header envelope, and is
 * left out when messaging is off.
 */
export function accountMenuLinks({
  isOwner,
  messagingOn,
}: {
  isOwner: boolean
  messagingOn: boolean
}): NavLink[] {
  return [
    ...(isOwner ? [{ label: 'My Business', href: '/dashboard' }] : []),
    { label: 'Account Overview', href: '/account' },
    SAVED_LINK,
    ...(messagingOn
      ? [{ label: 'Messages', href: isOwner ? OWNER_INBOX_PATH : CUSTOMER_INBOX_PATH }]
      : []),
    { label: 'Settings', href: '/account/settings' },
  ]
}
