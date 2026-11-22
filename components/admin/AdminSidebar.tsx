'use client'

import Link from 'next/link'
import { NavRail, RailTitle } from '@/components/nav/NavRail'
import {
  ADMIN_NAV_PREF_KEY,
  ADMIN_OVERVIEW,
  DEFAULT_OPEN_GROUPS,
  adminRailGroups,
} from '@/lib/admin/navGroups'

interface Props {
  role: 'admin' | 'super_admin'
  /**
   * Pending-work counts keyed by nav href (see `toSidebarCounts` in
   * `lib/admin/pendingCounts.ts`). An item with a count above zero gets a
   * pill; zero or missing renders the plain item. A closed group shows the
   * sum of its items. Optional so other callers and tests keep working.
   */
  counts?: Record<string, number>
}

/**
 * Admin navigation (ticket 251): Overview, then the founder's groups, in the
 * shared black rail (components/nav/NavRail.tsx). Below lg, a Menu button
 * opens the same menu in a drawer.
 */
export function AdminSidebar({ role, counts }: Props) {
  const roleLabel = role === 'super_admin' ? 'Super Admin' : 'Admin'
  return (
    <NavRail
      navLabel="Admin Navigation"
      testIdPrefix="admin-nav"
      lead={ADMIN_OVERVIEW}
      groups={adminRailGroups(counts)}
      storageKey={ADMIN_NAV_PREF_KEY}
      defaultOpen={DEFAULT_OPEN_GROUPS}
      brand={<RailTitle>{roleLabel}</RailTitle>}
      barTitle={<RailTitle mark={false}>{roleLabel}</RailTitle>}
      drawerTitle="Admin Menu"
      drawerDescription="Every admin page, grouped. Groups with waiting work show a count."
      footer={
        <Link
          href="/account"
          className="flex min-h-11 items-center rounded-lg px-3 font-subhead text-[15px] font-semibold text-white hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
        >
          Back to My Account
        </Link>
      }
    />
  )
}
