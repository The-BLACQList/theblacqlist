import Link from 'next/link'
import { cn } from '@/lib/utils'
import { EMBER_WASH } from '@/lib/design/surfaces'

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
  comingSoon?: boolean
}

// The founder's six categories, verbatim. Composite avenues pass their primary
// type to /discover; counts sum every underlying entity type they cover.
const AVENUES: Avenue[] = [
  { key: 'brick', label: 'Brick & Mortar', verb: 'shops & storefronts', href: '/discover?type=business' },
  { key: 'products', label: 'Products & Services', verb: 'shop & book', href: '/discover?type=service_provider' },
  { key: 'professionals', label: 'Professionals', verb: 'consult & advise', href: '/discover?type=professional' },
  { key: 'creatives', label: 'Creatives', verb: 'commission & collect', href: '/discover?type=creative' },
  { key: 'events', label: 'Events', verb: 'pull up', href: '/discover?type=event' },
  { key: 'jobs', label: 'Jobs', verb: 'find your next role', href: '#', comingSoon: true },
]

/**
 * The Avenues — one index, six avenues (Living Commerce Index breadth
 * section, named for the historic Black business districts). Sits directly
 * under the hero: every kind of Black enterprise gets a named way in.
 * TODO: tiles become commissioned documentary photographs when the set
 * lands — ember-glow grounds until then (never stock as real businesses).
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

            if (avenue.comingSoon) {
              return (
                <div
                  key={avenue.key}
                  className="flex flex-col justify-end min-h-[120px] rounded-xl bg-pale-lavender border border-dashed border-charcoal/30 p-4"
                >
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
