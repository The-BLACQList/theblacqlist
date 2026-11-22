// The admin side menu as plain data (ticket 251). The sidebar renders it; the
// tests read it. Groups are the founder's (2026-11-21): the queues that need a
// decision first, then content, people, numbers and tools.
//
// Every admin page appears exactly once. A new admin page needs a row here or
// it has no way in from the menu (tests/admin-nav-groups.test.ts checks every
// app/admin/<route>/page.tsx is listed).

import { isUnder, parseOpenSlugs } from '@/lib/nav/rail'

export { isUnder }

export interface AdminNavItem {
  href: string
  label: string
}

export interface AdminNavGroup {
  /** Stable id for test ids and the saved open/closed state. */
  slug: string
  label: string
  items: AdminNavItem[]
}

/** Sits above the groups on its own: it is the landing page, not a section. */
export const ADMIN_OVERVIEW: AdminNavItem = { href: '/admin', label: 'Overview' }

export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  {
    slug: 'to-review',
    label: 'To Review',
    items: [
      { href: '/admin/claims', label: 'Claims' },
      { href: '/admin/verification', label: 'Verification' },
      { href: '/admin/reviews', label: 'Reviews' },
      { href: '/admin/reports', label: 'Reports' },
      { href: '/admin/category-requests', label: 'Category Requests' },
      { href: '/admin/receipts', label: 'Receipts' },
      { href: '/admin/feedback', label: 'Feedback' },
    ],
  },
  {
    slug: 'pages-content',
    label: 'Pages & Content',
    items: [
      { href: '/admin/entities', label: 'Entities' },
      { href: '/admin/collections', label: 'Collections' },
      { href: '/admin/guides', label: 'Guides' },
      { href: '/admin/blacqlight', label: 'BLACQLight' },
      { href: '/admin/sponsored', label: 'Sponsored' },
      { href: '/admin/marketplace', label: 'Marketplace' },
    ],
  },
  {
    slug: 'people',
    label: 'People',
    items: [
      { href: '/admin/users', label: 'Users' },
      { href: '/admin/testers', label: 'Testers' },
    ],
  },
  {
    slug: 'insights',
    label: 'Insights',
    items: [
      { href: '/admin/analytics', label: 'Analytics' },
      { href: '/admin/ai-tools', label: 'AI Tools' },
    ],
  },
  {
    slug: 'tools',
    label: 'Tools',
    items: [{ href: '/admin/email-preview', label: 'Email Preview' }],
  },
]

/** Open on a first visit, before the admin has opened or closed anything. */
export const DEFAULT_OPEN_GROUPS = ['to-review']

/** The localStorage key holding the admin's open/closed choices. */
export const ADMIN_NAV_PREF_KEY = 'blacq-admin-nav'

/**
 * The group holding the page you are on, or null on the overview and on any
 * admin page the menu does not list. That group is always drawn open.
 */
export function groupForPath(pathname: string): AdminNavGroup | null {
  return ADMIN_NAV_GROUPS.find((g) => g.items.some((it) => isUnder(pathname, it.href))) ?? null
}

/** What a closed group shows: the sum of its items' waiting counts. */
export function groupCount(
  group: AdminNavGroup,
  counts: Record<string, number> | undefined
): number {
  if (!counts) return 0
  return group.items.reduce((sum, it) => sum + Math.max(0, counts[it.href] ?? 0), 0)
}

/** Everything waiting across the menu: the number on the phone Menu button. */
export function totalCount(counts: Record<string, number> | undefined): number {
  return ADMIN_NAV_GROUPS.reduce((sum, g) => sum + groupCount(g, counts), 0)
}

/**
 * Reads the saved choices. Anything unreadable (private window, old format,
 * hand-edited) falls back to the defaults rather than throwing.
 */
export function parseOpenGroups(raw: string | null): string[] {
  return parseOpenSlugs(
    raw,
    ADMIN_NAV_GROUPS.map((g) => g.slug),
    DEFAULT_OPEN_GROUPS
  )
}

/** The menu as rail groups: each item's waiting count becomes its badge. */
export function adminRailGroups(counts: Record<string, number> | undefined) {
  return ADMIN_NAV_GROUPS.map((g) => ({
    slug: g.slug,
    label: g.label,
    items: g.items.map((it) => ({ ...it, badge: counts?.[it.href] ?? 0 })),
  }))
}
