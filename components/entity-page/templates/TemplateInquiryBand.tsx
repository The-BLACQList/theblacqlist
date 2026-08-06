import Link from 'next/link'
import type { EntityPageData } from '@/types'
import { getCtaLabel } from '@/types'
import { getCtaHref } from '@/components/entity-page/templates/cta'

interface Props {
  entity: EntityPageData
}

/**
 * Dark conversion band with the quiet gold node field.
 * Claimed listings: the business-defined CTA plus a direct email.
 * Unclaimed listings: the platform's real goal — a claim invitation —
 * instead of inviting contact on behalf of a business that hasn't
 * claimed its page. Hidden entirely when there is no real action.
 */
export function TemplateInquiryBand({ entity }: Props) {
  const isUnclaimed = entity.trust_tier === 'unclaimed'
  const ctaLabel = getCtaLabel(entity.details.cta_type, entity.details.cta_label_override)
  const ctaHref = getCtaHref(entity)
  const email = entity.details.email

  if (!isUnclaimed && !ctaHref && !email) return null

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
        {isUnclaimed ? (
          <>
            <p className="font-subhead text-xs font-bold uppercase tracking-[0.12em] text-gold mb-1.5">
              Is this your business?
            </p>
            <h2
              id="inquire-heading"
              className="font-headline text-[23px] md:text-[32px] text-white max-w-[24ch] text-balance"
            >
              Claim your official BLACQList page
            </h2>
            <div className="flex items-center gap-3 flex-wrap mt-6">
              <Link
                href={`/claim/${entity.id}`}
                className="inline-flex items-center justify-center h-12 px-7 rounded-full bg-gold hover:bg-light-gold text-brand-black font-subhead font-bold text-sm transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
              >
                Claim this page
              </Link>
              <Link
                href={`/corrections?listing=${entity.id}`}
                className="inline-flex items-center justify-center h-12 px-7 rounded-full border border-off-white/40 bg-off-white/10 hover:bg-off-white/20 text-white font-subhead font-bold text-sm transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
              >
                Suggest a correction
              </Link>
            </div>
          </>
        ) : (
          <>
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
              {ctaHref && (
                <a
                  href={ctaHref}
                  className="inline-flex items-center justify-center h-12 px-7 rounded-full bg-gold hover:bg-light-gold text-brand-black font-subhead font-bold text-sm transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
                >
                  {ctaLabel}
                </a>
              )}
              {email && (
                <a
                  href={`mailto:${email}`}
                  className="inline-flex items-center justify-center h-12 px-7 rounded-full border border-off-white/40 bg-off-white/10 hover:bg-off-white/20 text-white font-subhead font-bold text-sm transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
                >
                  {email}
                </a>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  )
}
