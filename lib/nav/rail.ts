// The black side menu shared by admin (ticket 251) and the signed-in shell for
// members and owners (ticket 252). Plain data and pure helpers; the menu
// itself is components/nav/NavRail.tsx.

export interface RailItem {
  href: string
  label: string
  /**
   * Something waiting on you (unread, pending). Shown as a gold pill and
   * added into a closed group's total. Zero or missing shows nothing.
   */
  badge?: number
  /** What the badge means to a screen reader: "3 pending", "2 unread". */
  badgeLabel?: string
  /** A plain number (how many saved, how many reviews). Never added up. */
  count?: number
  /** Not open yet: shows a Soon pill. */
  soon?: boolean
  /** Only this exact address marks it current (Overview, Home). */
  exact?: boolean
}

export interface RailGroup {
  /** Stable id for test ids and the saved open/closed state. */
  slug: string
  label: string
  items: RailItem[]
}

/** True when `pathname` is `href` or a page below it (`/admin/claims/123`). */
export function isUnder(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`)
}

function matches(pathname: string, item: RailItem): boolean {
  return item.exact ? pathname === item.href : isUnder(pathname, item.href)
}

/**
 * The href of the item for the page you are on. The longest match wins, so
 * `/dashboard/pages/1/events/new` marks Events, not a shorter parent.
 */
export function activeHref(pathname: string, items: readonly RailItem[]): string | null {
  let best: string | null = null
  for (const item of items) {
    if (matches(pathname, item) && (best === null || item.href.length > best.length)) {
      best = item.href
    }
  }
  return best
}

/** Every item in the menu, the lead item (Overview) first. */
export function allItems(groups: readonly RailGroup[], lead?: RailItem): RailItem[] {
  return [...(lead ? [lead] : []), ...groups.flatMap((g) => g.items)]
}

/** The group holding the current page. It is always drawn open. */
export function activeGroupSlug(
  pathname: string,
  groups: readonly RailGroup[],
  lead?: RailItem
): string | null {
  const href = activeHref(pathname, allItems(groups, lead))
  if (!href) return null
  return groups.find((g) => g.items.some((it) => it.href === href))?.slug ?? null
}

/** What a closed group shows: everything waiting inside it. */
export function railGroupTotal(group: RailGroup): number {
  return group.items.reduce((sum, it) => sum + Math.max(0, it.badge ?? 0), 0)
}

/** Everything waiting across the menu: the number on the phone Menu button. */
export function railTotal(groups: readonly RailGroup[], lead?: RailItem): number {
  return groups.reduce((sum, g) => sum + railGroupTotal(g), 0) + Math.max(0, lead?.badge ?? 0)
}

/**
 * Reads saved open/closed choices. Anything unreadable (private window, old
 * format, hand-edited) falls back to the defaults rather than throwing.
 */
export function parseOpenSlugs(
  raw: string | null,
  known: readonly string[],
  defaults: readonly string[]
): string[] {
  if (!raw) return [...defaults]
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return [...defaults]
    const set = new Set(known)
    return parsed.filter((s): s is string => typeof s === 'string' && set.has(s))
  } catch {
    return [...defaults]
  }
}

/** "99+" past two digits, so a pill never grows wider than the rail allows. */
export function pillText(n: number): string {
  return n > 99 ? '99+' : String(n)
}
