export interface NavLink {
  label: string
  href: string
}

/** The header and mobile menu links, in order. */
export const MAIN_NAV_LINKS: NavLink[] = [
  { label: 'Discover', href: '/discover' },
  { label: 'Map', href: '/map' },
  { label: 'Cities', href: '/cities' },
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
