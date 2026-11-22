'use client'

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronRight, Menu, X } from 'lucide-react'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { SoonPill } from '@/components/ui/soon-pill'
import {
  activeGroupSlug,
  activeHref,
  allItems,
  parseOpenSlugs,
  pillText,
  railGroupTotal,
  railTotal,
  type RailGroup,
  type RailItem,
} from '@/lib/nav/rail'
import { cn } from '@/lib/utils'

export interface NavRailProps {
  /** The nav landmark's name, e.g. "Admin navigation". */
  navLabel: string
  /** Prefix for test ids: `<prefix>-group-<slug>`, `<prefix>-count-<label>`. */
  testIdPrefix: string
  groups: RailGroup[]
  /** One item above the groups, on its own (admin Overview). */
  lead?: RailItem
  /** localStorage key for the open/closed choices. */
  storageKey: string
  /** Groups open on a first visit. */
  defaultOpen: string[]
  /** Top of the panel: wordmark and a short label. */
  brand: ReactNode
  /** Left side of the phone bar. */
  barTitle: ReactNode
  /** Screen-reader name and description of the phone drawer. */
  drawerTitle: string
  drawerDescription: string
  /** Under the brand, above the groups (the owner's page switcher). */
  top?: ReactNode
  /** Under the groups (the "Own a Business?" card). */
  afterGroups?: ReactNode
  /** Pinned to the bottom of the panel. */
  footer?: ReactNode
}

const PILL =
  'inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-gold px-2 font-subhead text-sm font-bold tracking-normal tabular-nums text-brand-black'

function slugOf(label: string) {
  return label.toLowerCase().replace(/\s+/g, '-')
}

/**
 * Open/closed state per group, saved per browser. The raw string is the
 * snapshot (stable between renders); parsing happens after. The server
 * renders the defaults, so the first paint matches a first visit.
 */
function useOpenGroups(
  storageKey: string,
  known: string[],
  defaults: string[]
): [string[], (slug: string) => void] {
  const event = `${storageKey}-change`
  const raw = useSyncExternalStore(
    (callback) => {
      window.addEventListener(event, callback)
      window.addEventListener('storage', callback)
      return () => {
        window.removeEventListener(event, callback)
        window.removeEventListener('storage', callback)
      }
    },
    () => {
      try {
        return window.localStorage.getItem(storageKey)
      } catch {
        return null
      }
    },
    () => null
  )
  const open = parseOpenSlugs(raw, known, defaults)
  function toggle(slug: string) {
    const next = open.includes(slug) ? open.filter((s) => s !== slug) : [...open, slug]
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(next))
    } catch {
      // Storage blocked: the menu still works, it just won't remember.
    }
    window.dispatchEvent(new Event(event))
  }
  return [open, toggle]
}

function RailLink({
  item,
  active,
  testIdPrefix,
}: {
  item: RailItem
  active: boolean
  testIdPrefix: string
}) {
  const badge = item.badge ?? 0
  return (
    <Link
      href={item.href}
      className={cn(
        'flex min-h-11 items-center gap-2 rounded-lg px-3 py-2 font-subhead text-[15px] transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold',
        active
          ? 'bg-white/10 font-semibold text-white shadow-[inset_3px_0_0_var(--color-gold)]'
          : 'text-ink-soft hover:bg-white/5 hover:text-white'
      )}
      aria-current={active ? 'page' : undefined}
    >
      <span className="flex-1">{item.label}</span>
      {item.soon ? (
        <SoonPill />
      ) : (
        <>
          {/* A plain number is quiet; only waiting work gets the gold pill,
              so the one thing that matters doesn't look like the rest. */}
          {item.count !== undefined && item.count > 0 && (
            <span className="font-subhead text-sm tabular-nums text-ink-soft">{item.count}</span>
          )}
          {badge > 0 && (
            <span
              data-testid={`${testIdPrefix}-count-${slugOf(item.label)}`}
              aria-label={`${badge} ${item.badgeLabel ?? 'pending'}`}
              className={PILL}
            >
              {pillText(badge)}
            </span>
          )}
        </>
      )}
    </Link>
  )
}

/** The menu itself. Drawn in the desktop rail and inside the phone drawer. */
function RailPanel(props: NavRailProps) {
  const { navLabel, testIdPrefix, groups, lead, storageKey, defaultOpen } = props
  const pathname = usePathname()
  const [openGroups, toggle] = useOpenGroups(
    storageKey,
    groups.map((g) => g.slug),
    defaultOpen
  )
  const current = activeHref(pathname, allItems(groups, lead))
  const activeGroup = activeGroupSlug(pathname, groups, lead)

  return (
    <div className="flex h-full flex-col">
      <div className="px-5 pt-5 pb-3">{props.brand}</div>
      {props.top && <div className="px-3 pb-2">{props.top}</div>}

      <nav aria-label={navLabel} className="flex-1 overflow-y-auto px-3 pb-4">
        {lead && (
          <RailLink item={lead} active={current === lead.href} testIdPrefix={testIdPrefix} />
        )}
        {groups.map((group) => {
          if (group.items.length === 0) return null
          const isActive = activeGroup === group.slug
          // The group holding this page is always open, so the highlighted
          // item can never be hidden.
          const isOpen = isActive || openGroups.includes(group.slug)
          const total = railGroupTotal(group)
          const listId = `${testIdPrefix}-list-${group.slug}`
          return (
            <div
              key={group.slug}
              className="mt-1 border-t border-white/10 pt-1 first:mt-0 first:border-t-0 first:pt-0"
            >
              <button
                type="button"
                data-testid={`${testIdPrefix}-group-${group.slug}`}
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
                    data-testid={`${testIdPrefix}-group-total-${group.slug}`}
                    aria-label={`${total} waiting`}
                    className={PILL}
                  >
                    {pillText(total)}
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
                      <RailLink
                        item={item}
                        active={current === item.href}
                        testIdPrefix={testIdPrefix}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )
        })}
        {props.afterGroups && <div className="mt-3">{props.afterGroups}</div>}
      </nav>

      {props.footer && <div className="border-t border-white/10 px-3 py-3">{props.footer}</div>}
    </div>
  )
}

/**
 * The black side menu (tickets 251, 252). From lg: a sticky rail with
 * collapsible groups. Below lg: a black bar under the site header whose Menu
 * button opens the same panel in a drawer (focus stays inside; Esc, the
 * backdrop, Close Menu and opening a page all close it).
 */
export function NavRail(props: NavRailProps) {
  const pathname = usePathname()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const prevPathname = useRef(pathname)
  const waiting = railTotal(props.groups, props.lead)

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
      <aside className="sticky top-16 hidden h-[calc(100dvh-4rem)] w-68 shrink-0 bg-brand-black lg:block">
        <RailPanel {...props} />
      </aside>

      <div className="sticky top-14 z-40 flex h-15 items-center gap-3 border-t border-white/10 bg-brand-black px-4 md:top-16 lg:hidden">
        <div className="min-w-0 flex-1 truncate">{props.barTitle}</div>
        <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-expanded={drawerOpen}
            aria-haspopup="dialog"
            data-testid={`${props.testIdPrefix}-menu`}
            className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border border-white/50 px-4 font-subhead text-[15px] font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
          >
            <Menu className="size-4" aria-hidden="true" />
            Menu
            {waiting > 0 && (
              <span aria-label={`${waiting} waiting`} className={PILL}>
                {pillText(waiting)}
              </span>
            )}
          </button>
          <SheetContent
            side="left"
            className="w-80 max-w-[85vw] border-r-0 bg-brand-black p-0 [&>button:last-child]:hidden"
          >
            <SheetTitle className="sr-only">{props.drawerTitle}</SheetTitle>
            <SheetDescription className="sr-only">{props.drawerDescription}</SheetDescription>
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              aria-label="Close Menu"
              className="absolute top-3 right-3 z-10 inline-flex size-11 items-center justify-center rounded-full border border-white/50 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
            >
              <X className="size-5" aria-hidden="true" />
            </button>
            <RailPanel {...props} />
          </SheetContent>
        </Sheet>
      </div>
    </>
  )
}
