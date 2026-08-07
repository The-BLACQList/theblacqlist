import type { EntityPageData } from '@/types'
import { TemplateSectionHeading } from '@/components/entity-page/templates/TemplateSectionHeading'

interface Props {
  entity: EntityPageData
}

/**
 * Capabilities as an editorial list (Portfolio archetype) — the studio's
 * services set in Jost with gold markers, not filter-style pills.
 */
export function TemplateCapabilities({ entity }: Props) {
  const services = entity.details.services
  if (services.length === 0) return null

  return (
    <section id="capabilities" aria-labelledby="capabilities-heading" className="scroll-mt-32">
      <TemplateSectionHeading
        kicker="What we do"
        heading="Capabilities"
        headingId="capabilities-heading"
      />

      <ul className="columns-1 sm:columns-2 gap-12 max-w-xl list-none p-0 m-0">
        {services.map((service) => (
          <li
            key={service.id}
            className="flex items-baseline gap-3 py-2.5 border-b border-charcoal/10 break-inside-avoid"
          >
            <span className="size-[7px] rounded-full bg-amber shrink-0 translate-y-[-1px]" aria-hidden="true" />
            <div>
              <span className="font-headline text-[17px] md:text-[19px] text-brand-black">
                {service.name}
              </span>
              {service.price && (
                <span className="ml-2 font-subhead text-sm font-bold text-amber">
                  {service.price}
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
