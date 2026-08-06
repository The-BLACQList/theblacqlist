import type { EntityPageData } from '@/types'
import { TemplateSectionHeading } from '@/components/entity-page/templates/TemplateSectionHeading'
import { getCtaHref } from '@/components/entity-page/templates/cta'

interface Props {
  entity: EntityPageData
}

/**
 * Services-first offerings section for the Service archetype (P-A):
 * the first service becomes a dark feature card; the rest render as
 * pale-lavender cards. "What the business sells, visually — never a
 * paragraph" (Living Commerce Index anatomy ④).
 */
export function TemplateServices({ entity }: Props) {
  const services = entity.details.services
  if (services.length === 0) return null

  // Parity with the business offerings section: when the owner has grouped
  // their services (group_label), render menu-style grouped headings instead
  // of the flat feature-first layout.
  const hasGroups = services.some((s) => s.group)
  if (hasGroups) {
    const groups = new Map<string, typeof services>()
    for (const s of services) {
      const key = s.group ?? 'More'
      groups.set(key, [...(groups.get(key) ?? []), s])
    }
    return (
      <section id="services" aria-labelledby="services-heading" className="scroll-mt-32">
        <TemplateSectionHeading
          kicker="What we offer"
          heading="Services & packages"
          headingId="services-heading"
        />
        <div className="flex flex-col gap-8">
          {[...groups.entries()].map(([group, items]) => (
            <div key={group}>
              <h3 className="font-subhead text-xs font-bold uppercase tracking-[0.12em] text-charcoal mb-3">
                {group}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {items.map((service) => (
                  <article
                    key={service.id}
                    className="bg-pale-lavender rounded-xl p-5 flex flex-col gap-1.5"
                  >
                    <h4 className="font-headline text-[17px] text-brand-black">{service.name}</h4>
                    {service.price && (
                      <p className="font-subhead text-sm font-bold text-amber">{service.price}</p>
                    )}
                    {service.description && (
                      <p className="font-body text-sm text-charcoal">{service.description}</p>
                    )}
                  </article>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    )
  }

  const [feature, ...rest] = services
  if (!feature) return null
  const ctaHref = getCtaHref(entity)

  return (
    <section id="services" aria-labelledby="services-heading" className="scroll-mt-32">
      <TemplateSectionHeading
        kicker="What we offer"
        heading="Services & packages"
        headingId="services-heading"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Feature service — dark editorial card */}
        <article className="sm:col-span-2 bg-deep-bg text-white rounded-xl p-5 md:p-6 flex flex-col gap-2">
          <h3 className="font-headline text-[19px] md:text-[23px] text-white">{feature.name}</h3>
          {feature.price && (
            <p className="font-subhead text-sm font-bold text-gold">{feature.price}</p>
          )}
          {feature.description && (
            <p className="font-body text-sm text-off-white/85 max-w-2xl">{feature.description}</p>
          )}
          <a
            href={ctaHref}
            className="mt-2 self-start font-subhead text-sm font-bold text-white underline underline-offset-4 hover:text-gold transition-colors duration-150"
          >
            Request this service →
          </a>
        </article>

        {rest.map((service) => (
          <article
            key={service.id}
            className="bg-pale-lavender rounded-xl p-5 flex flex-col gap-1.5"
          >
            <h3 className="font-headline text-[17px] text-brand-black">{service.name}</h3>
            {service.price && (
              <p className="font-subhead text-sm font-bold text-amber">{service.price}</p>
            )}
            {service.description && (
              <p className="font-body text-sm text-charcoal">{service.description}</p>
            )}
          </article>
        ))}
      </div>
    </section>
  )
}
