import type { EntityPageData } from '@/types'
import { getCtaLabel } from '@/types'
import { getCtaHref } from '@/components/entity-page/templates/cta'

interface Props {
  entity: EntityPageData
}

/**
 * Dark inquiry band for the Portfolio archetype: quiet gold node field on
 * black, the business-defined CTA, and a direct email when one exists.
 */
export function TemplateInquiryBand({ entity }: Props) {
  const ctaLabel = getCtaLabel(entity.details.cta_type, entity.details.cta_label_override)
  const ctaHref = getCtaHref(entity)
  const email = entity.details.email

  return (
    <section
      id="inquire"
      aria-labelledby="inquire-heading"
      className="relative bg-deep-bg py-14 md:py-16 overflow-hidden scroll-mt-32"
    >
      <div
        className="absolute inset-0 opacity-20"
        aria-hidden="true"
        style={{
          backgroundImage: [
            'radial-gradient(circle at 12% 30%, var(--color-gold) 1.5px, transparent 2.4px)',
            'radial-gradient(circle at 68% 62%, var(--color-gold) 1.5px, transparent 2.4px)',
            'radial-gradient(circle at 40% 85%, var(--color-gold) 1.5px, transparent 2.4px)',
            'radial-gradient(circle at 90% 18%, var(--color-gold) 1.5px, transparent 2.4px)',
          ].join(', '),
          backgroundSize: '380px 380px',
        }}
      />

      <div className="relative max-w-7xl mx-auto w-full px-5 md:px-8 lg:px-10">
        <p className="font-subhead text-xs font-bold uppercase tracking-[0.12em] text-gold mb-1.5">
          Work with {entity.name}
        </p>
        <h2
          id="inquire-heading"
          className="font-headline text-[23px] md:text-[32px] text-white max-w-[24ch] text-balance"
        >
          Have a project in mind?
        </h2>

        <div className="flex items-center gap-3 flex-wrap mt-6">
          <a
            href={ctaHref}
            className="inline-flex items-center justify-center h-12 px-7 rounded-full bg-gold hover:bg-light-gold text-brand-black font-subhead font-bold text-sm transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
          >
            {ctaLabel}
          </a>
          {email && (
            <a
              href={`mailto:${email}`}
              className="inline-flex items-center justify-center h-12 px-7 rounded-full border border-off-white/40 bg-off-white/10 hover:bg-off-white/20 text-white font-subhead font-bold text-sm transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
            >
              {email}
            </a>
          )}
        </div>
      </div>
    </section>
  )
}
