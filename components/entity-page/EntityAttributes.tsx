import type { EntityAttributeGroup } from '@/types'

interface Props {
  attributes: EntityAttributeGroup[]
  /** true = render without the section band/container, for nesting inside a
      template column that already provides width, padding, and background. */
  bare?: boolean
}

/**
 * Renders a listing's grouped attributes (Identity & Ownership, Amenities,
 * Payment, …) as chip rows. Hidden when the listing has no attributes set.
 */
export function EntityAttributes({ attributes, bare = false }: Props) {
  if (!attributes || attributes.length === 0) return null

  return (
    <section
      aria-labelledby="attributes-heading"
      className={bare ? undefined : 'bg-cream py-12 md:py-16'}
    >
      <div className={bare ? undefined : 'max-w-7xl mx-auto w-full px-4 md:px-6 lg:px-8'}>
        <h2
          id="attributes-heading"
          className="font-headline text-[22px] md:text-[28px] text-brand-black mb-6"
        >
          What this business offers
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-6">
          {attributes.map((group) => (
            <div key={group.group}>
              <h3 className="font-subhead text-xs font-semibold text-charcoal uppercase tracking-wide mb-2">
                {group.group}
              </h3>
              <ul className="flex flex-wrap gap-2">
                {group.values.map((value) => (
                  <li
                    key={value.slug}
                    className="inline-flex items-center rounded-full bg-white border border-charcoal/10 text-brand-black text-xs font-subhead font-semibold px-3 py-1"
                  >
                    {value.name}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
