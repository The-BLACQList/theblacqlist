import Link from 'next/link'
import { CalendarClock, ImagePlus, Megaphone, ShoppingBag } from 'lucide-react'

// One tap to the jobs owners come back for (ticket 253).
export function QuickActions({ pageId, posts }: { pageId: string; posts: boolean }) {
  const actions = [
    { href: `/dashboard/pages/${pageId}/media`, label: 'Add Photos', Icon: ImagePlus },
    ...(posts
      ? [{ href: `/dashboard/pages/${pageId}/posts`, label: 'Post an Update', Icon: Megaphone }]
      : []),
    { href: '/dashboard/products', label: 'Products and Services', Icon: ShoppingBag },
    {
      href: `/dashboard/pages/${pageId}/special-hours`,
      label: 'Set Special Hours',
      Icon: CalendarClock,
    },
  ]
  return (
    <section aria-labelledby="quick-heading" data-testid="home-quick-actions">
      <h2 id="quick-heading" className="mb-3 font-headline text-lg text-brand-black">
        Quick Actions
      </h2>
      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {actions.map(({ href, label, Icon }) => (
          <li key={href}>
            <Link
              href={href}
              className="flex h-full min-h-[88px] flex-col justify-between gap-3 rounded-xl border border-charcoal/10 bg-white px-4 py-4 transition-colors hover:border-amber-gold focus-visible:border-amber-gold focus-visible:outline-none"
            >
              <Icon className="size-5 text-amber" aria-hidden="true" />
              <span className="font-subhead text-sm font-semibold text-brand-black">{label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
