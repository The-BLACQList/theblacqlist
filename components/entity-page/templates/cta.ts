import type { EntityPageData } from '@/types'

/**
 * Business-defined primary CTA href — same resolution as EntityPageHero:
 * "call" uses a tel: link when a phone exists; otherwise the owner's cta_url.
 */
export function getCtaHref(entity: EntityPageData): string {
  if (entity.details.cta_type === 'call' && entity.details.phone) {
    return `tel:${entity.details.phone.replace(/\D/g, '')}`
  }
  return entity.details.cta_url ?? '#'
}
