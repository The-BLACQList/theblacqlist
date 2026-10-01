import Image from 'next/image'
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
import { bannerPhotoFor } from '@/components/discovery/DiscoverBanner'
import { cn } from '@/lib/utils'
import { PHOTO_FOCAL } from '@/lib/design/surfaces'
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
  /** The DiscoverBanner key whose frame this tile shows. */
  banner: string
  comingSoon?: boolean
}

// The founder's six categories, verbatim. Composite avenues pass their primary
// type to /discover; counts sum every underlying entity type they cover.
const AVENUES: Avenue[] = [
  { key: 'brick', label: 'Brick & Mortar', verb: 'shops & storefronts', href: '/discover?type=business', icon: Store, banner: 'business' },
  // Not `?type=…`: this avenue is a location_type bin, not an entity_type one.
  // See PRODUCTS_SERVICES_LOCATION_TYPES — app/page.tsx counts from the same
  // constant, so the number on the tile and the page behind it cannot disagree.
  {
    key: 'products',
    label: 'Products & Services',
    verb: 'shop & book',
    href: `/discover?location_type=${PRODUCTS_SERVICES_LOCATION_TYPES.join(',')}`,
    icon: ShoppingBag,
    banner: 'service_provider',
  },
  { key: 'professionals', label: 'Professionals', verb: 'consult & advise', href: '/discover?type=professional', icon: Briefcase, banner: 'professional' },
  { key: 'creatives', label: 'Creatives', verb: 'commission & collect', href: '/discover?type=creative', icon: Palette, banner: 'creative' },
  { key: 'events', label: 'Events', verb: 'pull up', href: '/discover?type=event', icon: CalendarDays, banner: 'event' },
  { key: 'jobs', label: 'Jobs', verb: 'find your next role', href: '#', icon: Handshake, banner: 'job', comingSoon: true },
]

/** Two-across on phones, three on tablets, six from lg in a max-w-7xl row. */
const TILE_SIZES = '(max-width: 767px) 50vw, (max-width: 1023px) 33vw, 220px'

const SCRIM =
  'linear-gradient(to top, rgba(8,8,10,0.92) 0%, rgba(8,8,10,0.72) 45%, rgba(8,8,10,0.2) 100%)'

/**
 * The Avenues — one index, six avenues (Living Commerce Index breadth
 * section, named for the historic Black business districts). Sits directly
 * under the hero: every kind of Black enterprise gets a named way in.
 *
 * Each tile shows the same frame that heads its bin on /discover, so the
 * picture on the tile is the picture the click lands on [Decision — founder,
 * 2026-10-01]. This reverses the icon-only call of 2026-08-09. The frames sit
 * faded at rest so the row still reads as six labels first, and come up to
 * near full strength on hover, focus, or press.
 *
 * The scrim is what keeps the type legible, not the fade. It runs from 0.92
 * black at the bottom edge, where the label and the gold line sit, to 0.2 at
 * the top, so the label's worst case is set by the scrim's alpha rather than by
 * whatever the photograph has behind it. Do not thin the bottom of it.
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

            const photo = bannerPhotoFor(avenue.banner)

            if (avenue.comingSoon) {
              // Same frame, held grey and faint: present in the row, plainly
              // not open yet. Not a link, so nothing to hover.
              return (
                <div
                  key={avenue.key}
                  className="relative flex flex-col justify-end min-h-[120px] md:min-h-[136px] rounded-xl bg-deep-bg border border-dashed border-white/25 p-4 overflow-hidden"
                >
                  {photo && (
                    <Image
                      src={photo}
                      alt=""
                      fill
                      sizes={TILE_SIZES}
                      className={cn('object-cover opacity-20 grayscale', PHOTO_FOCAL[photo])}
                    />
                  )}
                  <span aria-hidden="true" className="absolute inset-0" style={{ background: SCRIM }} />
                  <Icon
                    size={20}
                    strokeWidth={1.5}
                    aria-hidden="true"
                    className="relative mb-auto text-white/50"
                  />
                  <span className="relative font-headline text-[17px] text-white/80 leading-tight">
                    {avenue.label}
                  </span>
                  <span className="relative mt-1 self-start rounded-full border border-white/30 px-2 py-0.5 font-subhead text-[9.5px] font-bold uppercase tracking-[0.08em] text-white/80">
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
                  'group relative flex flex-col justify-end min-h-[120px] md:min-h-[136px] rounded-xl bg-deep-bg p-4 overflow-hidden',
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber'
                )}
              >
                {photo && (
                  <Image
                    src={photo}
                    alt=""
                    fill
                    sizes={TILE_SIZES}
                    className={cn(
                      'object-cover opacity-30 transition-opacity duration-300 ease-out motion-reduce:transition-none',
                      'group-hover:opacity-90 group-focus-visible:opacity-90 group-active:opacity-90',
                      PHOTO_FOCAL[photo]
                    )}
                  />
                )}
                <span aria-hidden="true" className="absolute inset-0" style={{ background: SCRIM }} />
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
