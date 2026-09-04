import Link from 'next/link'
import {
  Briefcase,
  CalendarDays,
  Handshake,
  Palette,
  ShoppingBag,
  Store,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { EMBER_WASH } from '@/lib/design/surfaces'
import { PRODUCTS_SERVICES_LOCATION_TYPES } from '@/lib/constants/listing'

export interface AvenueCounts {
  brick: number
  products: number
  professionals: number
  creatives: number
  events: number
}

interface Props {
  counts: AvenueCounts
}

interface Avenue {
  key: keyof AvenueCounts | 'jobs'
  label: string
  verb: string
  href: string
  icon: LucideIcon
  comingSoon?: boolean
}

// The founder's six categories, verbatim. Composite avenues pass their primary
// type to /discover; counts sum every underlying entity type they cover.
const AVENUES: Avenue[] = [
  { key: 'brick', label: 'Brick & Mortar', verb: 'shops & storefronts', href: '/discover?type=business', icon: Store },
  // Not `?type=…`: this avenue is a location_type bin, not an entity_type one.
  // See PRODUCTS_SERVICES_LOCATION_TYPES — app/page.tsx counts from the same
  // constant, so the number on the tile and the page behind it cannot disagree.
  {
    key: 'products',
    label: 'Products & Services',
    verb: 'shop & book',
    href: `/discover?location_type=${PRODUCTS_SERVICES_LOCATION_TYPES.join(',')}`,
    icon: ShoppingBag,
  },
  { key: 'professionals', label: 'Professionals', verb: 'consult & advise', href: '/discover?type=professional', icon: Briefcase },
  { key: 'creatives', label: 'Creatives', verb: 'commission & collect', href: '/discover?type=creative', icon: Palette },
  { key: 'events', label: 'Events', verb: 'pull up', href: '/discover?type=event', icon: CalendarDays },
  { key: 'jobs', label: 'Jobs', verb: 'find your next role', href: '#', icon: Handshake, comingSoon: true },
]

/**
 * The Avenues — one index, six avenues (Living Commerce Index breadth
 * section, named for the historic Black business districts). Sits directly
 * under the hero: every kind of Black enterprise gets a named way in.
 *
 * Tiles carry an icon, not a photograph [Decision — founder, 2026-08-09].
 * This supersedes the earlier plan to commission documentary photography for
 * this row: the homepage already carries nine photographic surfaces across the
 * triptych and the bento inside one scroll, and six more frames here would
 * flatten the hierarchy rather than sharpen it. The icon does the one job the
 * row needs — six tiles reading as six distinct things at a glance — without
 * adding weight. Do not reintroduce photography here.
 *
 * Icons are `aria-hidden`: every tile already carries a visible text label, so
 * announcing the glyph would only duplicate it.
 */
export function TheAvenues({ counts }: Props) {
  return (
    <section aria-labelledby="avenues-heading" className="bg-off-white py-10 md:py-12">
      <div className="max-w-7xl mx-auto w-full px-5 md:px-8 lg:px-10">
        <p className="font-subhead text-xs font-bold uppercase tracking-[0.12em] text-amber mb-1.5">
          One index, six avenues
        </p>
        <h2 id="avenues-heading" className="sr-only">
          Explore by kind of business
        </h2>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5 mt-3">
          {AVENUES.map((avenue) => {
            const count = avenue.key === 'jobs' ? 0 : counts[avenue.key]
            const Icon = avenue.icon

            if (avenue.comingSoon) {
              return (
                <div
                  key={avenue.key}
                  className="flex flex-col justify-end min-h-[120px] rounded-xl bg-pale-lavender border border-dashed border-charcoal/30 p-4"
                >
                  <Icon
                    size={20}
                    strokeWidth={1.5}
                    aria-hidden="true"
                    className="mb-auto text-charcoal-soft"
                  />
                  <span className="font-headline text-[17px] text-charcoal leading-tight">
                    {avenue.label}
                  </span>
                  <span className="mt-1 self-start rounded-full border border-charcoal/20 px-2 py-0.5 font-subhead text-[9.5px] font-bold uppercase tracking-[0.08em] text-charcoal-soft">
                    Coming soon
                  </span>
                </div>
              )
            }

            return (
              <Link
                key={avenue.key}
                href={avenue.href}
                className={cn(
                  'group relative flex flex-col justify-end min-h-[120px] rounded-xl bg-deep-bg p-4 overflow-hidden',
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber'
                )}
              >
                <span
                  className="absolute inset-0 opacity-70 group-hover:opacity-100 transition-opacity duration-200"
                  aria-hidden="true"
                  style={{
                    background: EMBER_WASH,
                  }}
                />
                <Icon
                  size={20}
                  strokeWidth={1.5}
                  aria-hidden="true"
                  className="relative mb-auto text-gold/80 group-hover:text-light-gold transition-colors duration-150"
                />
                <span className="relative font-headline text-[17px] text-white leading-tight group-hover:text-light-gold transition-colors duration-150">
                  {avenue.label}
                </span>
                <span className="relative font-subhead text-[11px] font-semibold text-gold mt-0.5">
                  {avenue.verb}
                  {count > 0 ? ` · ${count.toLocaleString()}` : ''}
                </span>
              </Link>
            )
          })}
        </div>
      </div>
    </section>
  )
}
