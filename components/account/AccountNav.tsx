'use client'

import { useSyncExternalStore } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { cn } from '@/lib/utils'
import { signOutAction } from '@/lib/actions/auth/signOut'

const NAV_PREF_KEY = 'blacq-account-nav'

function subscribeToNavPref(callback: () => void) {
  window.addEventListener('blacq-account-nav-change', callback)
  window.addEventListener('storage', callback)
  return () => {
    window.removeEventListener('blacq-account-nav-change', callback)
    window.removeEventListener('storage', callback)
  }
}

export interface AccountNavCounts {
  saved: number
  reviews: number
  claims: number
  claimsPending: number
  receipts: number
}

interface Props {
  displayName: string
  memberSince: string
  counts: AccountNavCounts
  isOwner: boolean
}

interface NavItem {
  href: string
  label: string
  count?: number
  badge?: number
}

interface NavGroup {
  label: string
  items: NavItem[]
}

/**
 * AC-AB account shell navigation: persistent grouped sidebar on desktop
 * (identity block, live counts, no back-links anywhere), horizontal
 * scroll-nav on mobile.
 */
export function AccountNav({ displayName, memberSince, counts, isOwner }: Props) {
  const pathname = usePathname()

  // The sidebar is the user's choice: collapsed state persists across visits.
  // useSyncExternalStore keeps SSR/hydration safe (server snapshot = expanded).
  const collapsed = useSyncExternalStore(
    subscribeToNavPref,
    () => window.localStorage.getItem(NAV_PREF_KEY) === 'collapsed',
    () => false
  )
  function toggleCollapsed() {
    window.localStorage.setItem(NAV_PREF_KEY, collapsed ? 'expanded' : 'collapsed')
    window.dispatchEvent(new Event('blacq-account-nav-change'))
  }

  const groups: NavGroup[] = [
    {
      label: 'Activity',
      items: [
        { href: '/account', label: 'Overview' },
        { href: '/account/saved', label: 'Saved', count: counts.saved },
        { href: '/account/activity', label: 'Recently viewed' },
        { href: '/account/recommended', label: 'Recommended' },
      ],
    },
    {
      label: 'Contributions',
      items: [
        { href: '/account/claims', label: 'Claims', count: counts.claims, badge: counts.claimsPending },
        { href: '/account/reviews', label: 'Reviews', count: counts.reviews },
        { href: '/account/receipts', label: 'Receipts', count: counts.receipts },
        { href: '/account/community-spend', label: 'Community spend' },
      ],
    },
    ...(isOwner
      ? [{ label: 'Your business', items: [{ href: '/dashboard', label: 'My business' }] }]
      : []),
    {
      label: 'Account',
      items: [{ href: '/account/settings', label: 'Settings' }],
    },
  ]

  const initial = displayName.charAt(0).toUpperCase() || 'B'

  function isActive(href: string) {
    return href === '/account' ? pathname === '/account' : pathname.startsWith(href)
  }

  const linkClasses = (active: boolean) =>
    cn(
      'flex items-center justify-between gap-2 rounded-md px-2.5 py-2 font-subhead text-[13px] font-semibold transition-colors duration-150',
      active
        ? 'bg-pale-lavender text-brand-black border-l-[3px] border-amber'
        : 'text-charcoal hover:text-brand-black hover:bg-pale-lavender/60'
    )

  return (
    <>
      {/* Desktop sidebar — collapsible to a slim rail (the overview page is a
          complete navigation surface on its own, so hiding the nav loses nothing) */}
      <nav
        aria-label="Account"
        className={cn('hidden lg:block shrink-0', collapsed ? 'w-[56px]' : 'w-[240px]')}
      >
        {collapsed ? (
          <div className="sticky top-24 bg-white rounded-xl border border-charcoal/10 p-2 flex flex-col items-center gap-3">
            <span
              className="flex size-9 items-center justify-center rounded-full bg-deep-bg text-gold font-headline text-sm border-2 border-gold"
              aria-hidden="true"
            >
              {initial}
            </span>
            <button
              type="button"
              onClick={toggleCollapsed}
              aria-label="Show account navigation"
              aria-expanded="false"
              className="flex size-9 items-center justify-center rounded-md text-charcoal hover:text-brand-black hover:bg-pale-lavender transition-colors duration-150"
            >
              <PanelLeftOpen className="size-4.5" aria-hidden="true" />
            </button>
          </div>
        ) : (
        <div className="sticky top-24 bg-white rounded-xl border border-charcoal/10 p-4">
          <div className="flex items-center gap-3 pb-4 mb-3 border-b border-charcoal/10">
            <span
              className="flex size-10 items-center justify-center rounded-full bg-deep-bg text-gold font-headline text-base border-2 border-gold"
              aria-hidden="true"
            >
              {initial}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-headline text-sm text-brand-black truncate">{displayName}</p>
              <p className="font-subhead text-[11px] text-charcoal-soft">Member since {memberSince}</p>
            </div>
            <button
              type="button"
              onClick={toggleCollapsed}
              aria-label="Hide account navigation"
              aria-expanded="true"
              className="flex size-8 shrink-0 items-center justify-center rounded-md text-charcoal-faint hover:text-brand-black hover:bg-pale-lavender transition-colors duration-150"
            >
              <PanelLeftClose className="size-4" aria-hidden="true" />
            </button>
          </div>

          {groups.map((group) =>
            group.items.length === 0 ? null : (
              <div key={group.label} className="mb-3 last:mb-0">
                <p className="font-subhead text-[10px] font-bold uppercase tracking-[0.12em] text-amber px-2.5 mb-1">
                  {group.label}
                </p>
                <ul className="flex flex-col gap-0.5">
                  {group.items.map((item) => (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={isActive(item.href) ? 'page' : undefined}
                        className={linkClasses(isActive(item.href))}
                      >
                        <span>{item.label}</span>
                        {item.badge ? (
                          <span className="rounded-full bg-light-gold/30 border border-amber/40 text-amber text-[10.5px] font-bold px-1.5 py-px">
                            {item.badge}
                          </span>
                        ) : item.count !== undefined && item.count > 0 ? (
                          <span className="text-[11px] text-charcoal-faint font-medium">
                            {item.count}
                          </span>
                        ) : null}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )
          )}

          <form action={signOutAction} className="mt-1 border-t border-charcoal/10 pt-2">
            <button
              type="submit"
              className="w-full text-left rounded-md px-2.5 py-2 font-subhead text-[13px] font-semibold text-red-800 hover:bg-red-50 transition-colors duration-150"
            >
              Sign out
            </button>
          </form>
        </div>
        )}
      </nav>

      {/* Mobile horizontal scroll-nav */}
      <nav
        aria-label="Account"
        className="lg:hidden -mx-4 px-4 border-b border-charcoal/10 bg-white sticky top-14 md:top-16 z-30"
      >
        <ul className="flex gap-1 overflow-x-auto py-1">
          {groups.flatMap((g) => g.items).map((item) => (
            <li key={item.href} className="shrink-0">
              <Link
                href={item.href}
                aria-current={isActive(item.href) ? 'page' : undefined}
                className={cn(
                  'inline-flex items-center gap-1.5 min-h-11 px-3 font-subhead text-[13px] font-semibold whitespace-nowrap border-b-2 transition-colors duration-150',
                  isActive(item.href)
                    ? 'text-brand-black border-amber'
                    : 'text-charcoal border-transparent'
                )}
              >
                {item.label}
                {item.badge ? (
                  <span className="rounded-full bg-light-gold/30 border border-amber/40 text-amber text-[10px] font-bold px-1.5 py-px">
                    {item.badge}
                  </span>
                ) : null}
              </Link>
            </li>
          ))}
          <li className="shrink-0 ml-auto">
            <form action={signOutAction}>
              <button
                type="submit"
                className="inline-flex items-center min-h-11 px-3 font-subhead text-[13px] font-semibold whitespace-nowrap text-red-800 border-b-2 border-transparent"
              >
                Sign out
              </button>
            </form>
          </li>
        </ul>
      </nav>
    </>
  )
}
