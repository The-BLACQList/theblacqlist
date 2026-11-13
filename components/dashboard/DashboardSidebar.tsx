'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  FileText,
  Package,
  Briefcase,
  Sparkles,
  ChevronRight,
  ReceiptText,
  MessageCircle,
} from 'lucide-react'

import { GoldBrandMark } from '@/components/ui/gold-brand-mark'

interface Props {
  ownerEmail?: string
  /** False when the user owns no listing yet. Products, Services and Upgrade
   *  each need a listing (requireOwner sends them to /account), so they stay
   *  hidden until there is one. */
  hasListings?: boolean
  /** Receipts waiting for this owner to verify (ticket 183). Shown as a badge. */
  receiptsToVerify?: number
  /** ownerReceiptReview is on. Off, "Receipts to verify" is hidden. */
  showReceipts?: boolean
  /** Unread messages. Undefined hides the Messages item (flag off). */
  messagesUnread?: number
}

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard, exact: true },
  { href: '/dashboard/pages', label: 'My Pages', icon: FileText, exact: false },
  {
    href: '/dashboard/receipts',
    label: 'Receipts to verify',
    icon: ReceiptText,
    exact: false,
    needsListing: true,
  },
  { href: '/dashboard/products', label: 'Products', icon: Package, exact: false, needsListing: true },
  { href: '/dashboard/services', label: 'Services', icon: Briefcase, exact: false, needsListing: true },
  { href: '/dashboard/upgrade', label: 'Upgrade', icon: Sparkles, exact: false, needsListing: true },
]

const MESSAGES_ITEM = {
  href: '/dashboard/messages',
  label: 'Messages',
  icon: MessageCircle,
  exact: false,
  needsListing: true,
}

export function DashboardSidebar({
  ownerEmail,
  hasListings = true,
  receiptsToVerify = 0,
  showReceipts = false,
  messagesUnread,
}: Props) {
  const pathname = usePathname()
  const allItems =
    messagesUnread === undefined ? NAV_ITEMS : [...NAV_ITEMS.slice(0, 2), MESSAGES_ITEM, ...NAV_ITEMS.slice(2)]
  const navItems = allItems.filter(
    (item) =>
      (hasListings || !('needsListing' in item)) &&
      (showReceipts || item.href !== '/dashboard/receipts')
  )

  // Extract entityId from /dashboard/pages/[entityId]/...
  const entityMatch = pathname.match(/^\/dashboard\/pages\/([^/]+)/)
  const entityId = entityMatch?.[1]

  function isActive(href: string, exact: boolean) {
    if (exact) return pathname === href
    return pathname.startsWith(href)
  }

  // Phones get a full-width bar with rows that scroll sideways, so the page
  // keeps the whole screen width; md and up keep the side column.
  return (
    <aside className="w-full md:w-56 shrink-0 bg-brand-black md:min-h-screen flex flex-col">
      {/* Logo area */}
      <div className="px-4 py-3 md:px-5 md:py-5 border-b border-white/10">
        <Link
          href="/dashboard"
          className="font-headline text-base text-gold leading-tight flex items-center gap-3"
        >
          <GoldBrandMark className="h-8 w-8 shrink-0" />
          <span>
            BLACQList
            <br />
            <span className="text-xs text-white/60 font-subhead font-normal">Owner Dashboard</span>
          </span>
        </Link>
      </div>

      {/* Main nav */}
      <nav className="flex-1 px-3 py-2 md:py-4" aria-label="Dashboard navigation">
        <div className="flex gap-1 overflow-x-auto md:block md:space-y-0.5">
          {navItems.map(({ href, label, icon: Icon, exact }) => {
            const active = isActive(href, exact)
            return (
              <Link
                key={href}
                href={href}
                className={`flex shrink-0 items-center gap-2.5 whitespace-nowrap px-3 py-2 rounded-lg font-subhead text-sm transition-colors ${
                  active
                    ? 'bg-amber-gold/15 text-gold'
                    : 'text-white/70 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon className="size-4 shrink-0" aria-hidden="true" />
                {label}
                {href === '/dashboard/receipts' && receiptsToVerify > 0 && (
                  <span className="ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-amber-gold px-1.5 font-subhead text-[11px] font-bold leading-5 text-brand-black">
                    {receiptsToVerify > 99 ? '99+' : receiptsToVerify}
                    <span className="sr-only"> waiting</span>
                  </span>
                )}
                {href === MESSAGES_ITEM.href && messagesUnread ? (
                  <span className="ml-auto inline-flex min-w-5 h-5 items-center justify-center rounded-full bg-gold px-1.5 font-subhead text-[11px] font-bold text-brand-black">
                    {messagesUnread > 99 ? '99+' : messagesUnread}
                    <span className="sr-only"> unread</span>
                  </span>
                ) : null}
              </Link>
            )
          })}
        </div>

        {/* Page-specific nav when on a page route */}
        {entityId && (
          <div className="pt-2 mt-2 md:pt-3 md:mt-1 border-t border-white/10">
            <p className="px-3 pb-1 font-subhead text-[10px] uppercase tracking-widest text-ink-soft">
              This page
            </p>
            <div className="flex gap-1 overflow-x-auto md:block">
              {[
                { href: `/dashboard/pages/${entityId}/edit`, label: 'Edit content' },
                { href: `/dashboard/pages/${entityId}/offerings`, label: 'Offerings' },
                { href: `/dashboard/pages/${entityId}/events`, label: 'Events' },
                { href: `/dashboard/pages/${entityId}/media`, label: 'Media' },
                { href: `/dashboard/pages/${entityId}/analytics`, label: 'Analytics' },
                { href: `/dashboard/pages/${entityId}/verification`, label: 'Get Verified' },
              ].map(({ href, label }) => {
                const active = pathname === href || pathname.startsWith(href + '/')
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`flex shrink-0 items-center gap-2 whitespace-nowrap px-3 py-2 rounded-lg font-subhead text-sm transition-colors ${
                      active
                        ? 'bg-amber-gold/15 text-gold'
                        : 'text-white/70 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <ChevronRight className="size-3 shrink-0 opacity-50" aria-hidden="true" />
                    {label}
                  </Link>
                )
              })}
            </div>
          </div>
        )}
      </nav>

      {/* Footer */}
      {ownerEmail && (
        <div className="flex items-baseline justify-between gap-3 px-4 py-2 md:block md:px-5 md:py-4 border-t border-white/10">
          <p className="font-mono text-[10px] text-ink-soft truncate">{ownerEmail}</p>
          <Link
            href="/account"
            className="shrink-0 font-subhead text-xs text-white/50 hover:text-white/80 md:mt-0.5 block"
          >
            Account settings →
          </Link>
        </div>
      )}
    </aside>
  )
}
