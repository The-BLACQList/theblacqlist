export interface NavLink {
  label: string
  href: string
}

const PUBLIC_LINKS: NavLink[] = [
  { label: 'Discover', href: '/discover' },
  { label: 'Map', href: '/map' },
  { label: 'Cities', href: '/cities' },
  { label: 'The Collective', href: '/flow-map' },
  { label: 'For Business', href: '/for-business' },
]

/**
 * The header and mobile menu links, in order. Signed-in visitors also get
 * Saved, right after Map.
 * [Decision — founder, 2026-10-15 (simplicity M1): tester said saved places
 * had "nothing [that] navigates you back to them."]
 */
export function mainNavLinks(isSignedIn: boolean): NavLink[] {
  if (!isSignedIn) return PUBLIC_LINKS
  const afterMap = PUBLIC_LINKS.findIndex((l) => l.href === '/map') + 1
  return [
    ...PUBLIC_LINKS.slice(0, afterMap),
    { label: 'Saved', href: '/account/saved' },
    ...PUBLIC_LINKS.slice(afterMap),
  ]
}
