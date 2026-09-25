'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, FileText, Package, Briefcase, Sparkles, ChevronRight } from 'lucide-react'

import { GoldBrandMark } from '@/components/ui/gold-brand-mark'

interface Props {
  ownerEmail?: string
}

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard, exact: true },
  { href: '/dashboard/pages', label: 'My Pages', icon: FileText, exact: false },
  { href: '/dashboard/products', label: 'Products', icon: Package, exact: false },
  { href: '/dashboard/services', label: 'Services', icon: Briefcase, exact: false },
  { href: '/dashboard/upgrade', label: 'Upgrade', icon: Sparkles, exact: false },
]

export function DashboardSidebar({ ownerEmail }: Props) {
  const pathname = usePathname()

  // Extract entityId from /dashboard/pages/[entityId]/...
  const entityMatch = pathname.match(/^\/dashboard\/pages\/([^/]+)/)
  const entityId = entityMatch?.[1]

  function isActive(href: string, exact: boolean) {
    if (exact) return pathname === href
    return pathname.startsWith(href)
  }

  return (
    <aside className="w-56 shrink-0 bg-brand-black min-h-screen flex flex-col">
      {/* Logo area */}
      <div className="px-5 py-5 border-b border-white/10">
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
      <nav className="flex-1 px-3 py-4 space-y-0.5" aria-label="Dashboard navigation">
        {NAV_ITEMS.map(({ href, label, icon: Icon, exact }) => {
          const active = isActive(href, exact)
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg font-subhead text-sm transition-colors ${
                active
                  ? 'bg-amber-gold/15 text-gold'
                  : 'text-white/70 hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon className="size-4 shrink-0" aria-hidden="true" />
              {label}
            </Link>
          )
        })}

        {/* Page-specific nav when on a page route */}
        {entityId && (
          <div className="pt-3 mt-1 border-t border-white/10">
            <p className="px-3 pb-1 font-subhead text-[10px] uppercase tracking-widest text-white/30">
              This page
            </p>
            {[
              { href: `/dashboard/pages/${entityId}/edit`, label: 'Edit content' },
              { href: `/dashboard/pages/${entityId}/offerings`, label: 'Offerings' },
              { href: `/dashboard/pages/${entityId}/media`, label: 'Media' },
              { href: `/dashboard/pages/${entityId}/analytics`, label: 'Analytics' },
              { href: `/dashboard/pages/${entityId}/ai-suggestions`, label: 'AI Suggestions' },
              { href: `/dashboard/pages/${entityId}/verification`, label: 'Get Verified' },
            ].map(({ href, label }) => {
              const active = pathname === href || pathname.startsWith(href + '/')
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg font-subhead text-sm transition-colors ${
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
        )}
      </nav>

      {/* Footer */}
      {ownerEmail && (
        <div className="px-5 py-4 border-t border-white/10">
          <p className="font-mono text-[10px] text-white/30 truncate">{ownerEmail}</p>
          <Link
            href="/account"
            className="font-subhead text-xs text-white/50 hover:text-white/80 mt-0.5 block"
          >
            Account settings →
          </Link>
        </div>
      )}
    </aside>
  )
}
