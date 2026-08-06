import {
  Globe,
  CalendarCheck,
  BookOpen,
  ShoppingBag,
  Share2,
  Link2,
  ExternalLink,
  type LucideIcon,
} from 'lucide-react'
import type { EntityPageData } from '@/types'

const OTHER_META = { label: 'Link', Icon: Link2 as LucideIcon }

// lucide dropped brand glyphs, so social types share one generic icon (the page
// already lists socials in At-a-Glance) while action links get specific icons.
const TYPE_META: Record<string, { label: string; Icon: LucideIcon }> = {
  website: { label: 'Website', Icon: Globe },
  booking: { label: 'Book now', Icon: CalendarCheck },
  menu: { label: 'View menu', Icon: BookOpen },
  order: { label: 'Order online', Icon: ShoppingBag },
  instagram: { label: 'Instagram', Icon: Share2 },
  facebook: { label: 'Facebook', Icon: Share2 },
  tiktok: { label: 'TikTok', Icon: Share2 },
  youtube: { label: 'YouTube', Icon: Share2 },
  linkedin: { label: 'LinkedIn', Icon: Share2 },
  twitter: { label: 'X', Icon: Share2 },
  other: OTHER_META,
}

function metaFor(type: string): { label: string; Icon: LucideIcon } {
  return TYPE_META[type] ?? OTHER_META
}

export function EntityLinks({
  entity,
  bare = false,
}: {
  entity: EntityPageData
  /** true = render only the pill list, for nesting inside a template column
      that already provides section width/padding (avoids double insets). */
  bare?: boolean
}) {
  const links = entity.links ?? []
  if (links.length === 0) return null

  return (
    <section
      aria-labelledby="links-heading"
      className={bare ? undefined : 'bg-white pb-12 md:pb-16'}
    >
      <div className={bare ? undefined : 'max-w-7xl mx-auto w-full px-4 md:px-6 lg:px-8'}>
        <h2 id="links-heading" className="sr-only">
          Links
        </h2>
        <ul className="flex flex-wrap gap-2.5">
          {links.map((link) => {
            const { label, Icon } = metaFor(link.type)
            const text = link.label?.trim() || label
            return (
              <li key={link.id}>
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="inline-flex items-center gap-2 rounded-full border border-charcoal/15 bg-white px-4 py-2.5 font-subhead text-sm font-semibold text-brand-black hover:border-amber-gold hover:bg-amber-50/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-gold/50 transition-colors"
                >
                  <Icon className="size-4 text-amber shrink-0" aria-hidden="true" />
                  <span>{text}</span>
                  <ExternalLink className="size-3.5 text-charcoal-faint shrink-0" aria-hidden="true" />
                </a>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
