'use client'

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronRight, Menu, X } from 'lucide-react'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import {
  ADMIN_NAV_GROUPS,
  ADMIN_NAV_PREF_KEY,
  ADMIN_OVERVIEW,
  groupCount,
  groupForPath,
  isUnder,
  parseOpenGroups,
  totalCount,
} from '@/lib/admin/navGroups'
import { cn } from '@/lib/utils'

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

const PREF_EVENT = 'blacq-admin-nav-change'

function subscribe(callback: () => void) {
  window.addEventListener(PREF_EVENT, callback)
  window.addEventListener('storage', callback)
  return () => {
    window.removeEventListener(PREF_EVENT, callback)
    window.removeEventListener('storage', callback)
  }
}

function readPref(): string | null {
  try {
    return window.localStorage.getItem(ADMIN_NAV_PREF_KEY)
  } catch {
    return null
  }
}

/**
 * Open/closed state per group, saved per browser. The raw string is the
 * snapshot (stable between renders); parsing happens after. The server
 * renders the defaults, so the first paint matches a first visit.
 */
function useOpenGroups(): [string[], (slug: string) => void] {
  const raw = useSyncExternalStore(subscribe, readPref, () => null)
  const open = parseOpenGroups(raw)
  function toggle(slug: string) {
    const next = open.includes(slug) ? open.filter((s) => s !== slug) : [...open, slug]
    try {
      window.localStorage.setItem(ADMIN_NAV_PREF_KEY, JSON.stringify(next))
    } catch {
      // Storage blocked: the menu still works, it just won't remember.
    }
    window.dispatchEvent(new Event(PREF_EVENT))
  }
  return [open, toggle]
}

const PILL =
  'inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-gold px-2 font-subhead text-sm font-bold tracking-normal tabular-nums text-brand-black'

function NavLink({
  href,
  label,
  counts,
  active,
}: {
  href: string
  label: string
  counts?: Record<string, number>
  active: boolean
}) {
  const pending = counts?.[href] ?? 0
  return (
    <Link
      href={href}
      className={cn(
        'flex min-h-11 items-center gap-2 rounded-lg px-3 py-2 font-subhead text-[15px] transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold',
        active
          ? 'bg-white/10 font-semibold text-white shadow-[inset_3px_0_0_var(--color-gold)]'
          : 'text-ink-soft hover:bg-white/5 hover:text-white'
      )}
      aria-current={active ? 'page' : undefined}
    >
      <span className="flex-1">{label}</span>
      {/* Pending-work pill. Rendered only above zero: an empty "0" next to
          every item is noise, and the founder's complaint was that the one
          item that mattered looked like all the others. */}
      {pending > 0 && (
        <span
          data-testid={`admin-nav-count-${label.toLowerCase().replace(/\s+/g, '-')}`}
          aria-label={`${pending} pending`}
          className={PILL}
        >
          {pending}
        </span>
      )}
    </Link>
  )
}

/** The menu itself. Drawn in the desktop rail and inside the phone drawer. */
function AdminNavPanel({ role, counts }: Props) {
  const pathname = usePathname()
  const [openGroups, toggle] = useOpenGroups()
  const activeGroup = groupForPath(pathname)

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-baseline gap-2 px-5 pt-5 pb-4">
        <span className="font-headline text-xl font-semibold text-white">
          BLACQ<span className="text-gold">List</span>
        </span>
        <span className="font-subhead text-sm font-semibold text-ink-soft">
          {role === 'super_admin' ? 'Super Admin' : 'Admin'}
        </span>
      </div>

      <nav aria-label="Admin navigation" className="flex-1 overflow-y-auto px-3 pb-4">
        <NavLink
          href={ADMIN_OVERVIEW.href}
          label={ADMIN_OVERVIEW.label}
          active={pathname === ADMIN_OVERVIEW.href}
        />
        {ADMIN_NAV_GROUPS.map((group) => {
          const isActive = activeGroup?.slug === group.slug
          // The group holding this page is always open, so the highlighted
          // item can never be hidden.
          const isOpen = isActive || openGroups.includes(group.slug)
          const total = groupCount(group, counts)
          const listId = `admin-nav-list-${group.slug}`
          return (
            <div key={group.slug} className="mt-1 border-t border-white/10 pt-1">
              <button
                type="button"
                data-testid={`admin-nav-group-${group.slug}`}
                aria-expanded={isOpen}
                aria-controls={listId}
                aria-disabled={isActive || undefined}
                onClick={() => {
                  if (!isActive) toggle(group.slug)
                }}
                className={cn(
                  'flex min-h-11 w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left',
                  'font-subhead text-sm font-semibold uppercase tracking-[0.06em] text-ink-soft',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold',
                  isActive ? 'cursor-default' : 'hover:text-white'
                )}
              >
                <span className="flex-1">{group.label}</span>
                {!isOpen && total > 0 && (
                  <span
                    data-testid={`admin-nav-group-total-${group.slug}`}
                    aria-label={`${total} pending`}
                    className={PILL}
                  >
                    {total}
                  </span>
                )}
                <ChevronRight
                  aria-hidden="true"
                  className={cn(
                    'size-4 shrink-0 transition-transform motion-reduce:transition-none',
                    isOpen && 'rotate-90'
                  )}
                />
              </button>
              {isOpen && (
                <ul id={listId} className="space-y-0.5 pb-1">
                  {group.items.map((item) => (
                    <li key={item.href}>
                      <NavLink
                        href={item.href}
                        label={item.label}
                        counts={counts}
                        active={isUnder(pathname, item.href)}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )
        })}
      </nav>

      <div className="border-t border-white/10 px-3 py-3">
        <Link
          href="/account"
          className="flex min-h-11 items-center rounded-lg px-3 font-subhead text-[15px] font-semibold text-white hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
        >
          Back to My Account
        </Link>
      </div>
    </div>
  )
}

/**
 * Admin shell navigation (ticket 251). Desktop: a sticky black rail with
 * collapsible groups. Below md: a top bar whose Menu button opens the same
 * panel in a drawer (focus stays inside; Esc and route changes close it).
 */
export function AdminSidebar({ role, counts }: Props) {
  const pathname = usePathname()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const prevPathname = useRef(pathname)
  const waiting = totalCount(counts)

  useEffect(() => {
    if (prevPathname.current !== pathname) {
      prevPathname.current = pathname
      setDrawerOpen(false)
    }
  }, [pathname])

  return (
    <>
      {/* The site header is fixed above this (h-14 phones, h-16 md+), so the
          rail and the phone bar pin just below it. */}
      <aside className="sticky top-16 hidden h-[calc(100dvh-4rem)] w-64 shrink-0 bg-brand-black md:block">
        <AdminNavPanel role={role} counts={counts} />
      </aside>

      <div className="sticky top-14 z-40 flex h-15 items-center gap-3 border-t border-white/10 bg-brand-black px-4 md:hidden">
        <span className="flex-1 font-headline text-lg font-semibold text-white">
          BLACQ<span className="text-gold">List</span>{' '}
          <span className="font-subhead text-sm font-semibold text-ink-soft">Admin</span>
        </span>
        <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-expanded={drawerOpen}
            aria-haspopup="dialog"
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/50 px-4 font-subhead text-[15px] font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
          >
            <Menu className="size-4" aria-hidden="true" />
            Menu
            {waiting > 0 && (
              <span aria-label={`${waiting} pending`} className={PILL}>
                {waiting}
              </span>
            )}
          </button>
          <SheetContent
            side="left"
            className="w-80 max-w-[85vw] border-r-0 bg-brand-black p-0 [&>button:last-child]:hidden"
          >
            <SheetTitle className="sr-only">Admin Menu</SheetTitle>
            <SheetDescription className="sr-only">
              Every admin page, grouped. Groups with waiting work show a count.
            </SheetDescription>
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              aria-label="Close Menu"
              className="absolute top-3 right-3 z-10 inline-flex size-11 items-center justify-center rounded-full border border-white/50 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
            >
              <X className="size-5" aria-hidden="true" />
            </button>
            <AdminNavPanel role={role} counts={counts} />
          </SheetContent>
        </Sheet>
      </div>
    </>
  )
}
