'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  FileText,
  BadgeCheck,
  MessageSquare,
  Flag,
  BarChart3,
  ShieldCheck,
  Layers,
  BookOpen,
  Lightbulb,
  ClipboardCheck,
  ShoppingBag,
  Sparkles,
  Users,
  Megaphone,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  role: 'admin' | 'super_admin'
}

const NAV_ITEMS = [
  { href: '/admin', label: 'Overview', icon: LayoutDashboard, exact: true },
  { href: '/admin/entities', label: 'Entities', icon: FileText, exact: false },
  { href: '/admin/claims', label: 'Claims', icon: ShieldCheck, exact: false },
  { href: '/admin/verification', label: 'Verification', icon: BadgeCheck, exact: false },
  { href: '/admin/reviews', label: 'Reviews', icon: MessageSquare, exact: false },
  { href: '/admin/reports', label: 'Reports', icon: Flag, exact: false },
  { href: '/admin/analytics', label: 'Analytics', icon: BarChart3, exact: false },
  { href: '/admin/collections', label: 'Collections', icon: Layers, exact: false },
  { href: '/admin/guides', label: 'Guides', icon: BookOpen, exact: false },
  { href: '/admin/blacqlight', label: 'BLACQLight', icon: Lightbulb, exact: false },
  { href: '/admin/receipts', label: 'Receipts', icon: ClipboardCheck, exact: false },
  { href: '/admin/marketplace', label: 'Marketplace', icon: ShoppingBag, exact: false },
  { href: '/admin/sponsored', label: 'Sponsored', icon: Megaphone, exact: false },
  { href: '/admin/ai-tools', label: 'AI Tools', icon: Sparkles, exact: false },
  { href: '/admin/users', label: 'Users', icon: Users, exact: false },
]

export function AdminSidebar({ role }: Props) {
  const pathname = usePathname()

  return (
    <aside className="w-56 shrink-0 bg-brand-black min-h-screen flex flex-col">
      {/* Logo / brand */}
      <div className="px-5 py-5 border-b border-white/10">
        <p className="font-headline text-white text-lg leading-tight">BLACQList</p>
        <p className="font-subhead text-xs text-white/40 mt-0.5">Admin panel</p>
      </div>

      {/* Navigation */}
      <nav aria-label="Admin navigation" className="flex-1 py-4 px-3 space-y-0.5">
        {NAV_ITEMS.map(({ href, label, icon: Icon, exact }) => {
          const isActive = exact ? pathname === href : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg font-subhead text-sm transition-colors',
                isActive
                  ? 'bg-white/10 text-white'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              )}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon className="size-4 shrink-0" aria-hidden="true" />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Role badge */}
      <div className="px-5 py-4 border-t border-white/10">
        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-amber-gold/20 text-amber-gold text-xs font-subhead font-semibold">
          {role === 'super_admin' ? 'Super Admin' : 'Admin'}
        </span>
      </div>
    </aside>
  )
}
