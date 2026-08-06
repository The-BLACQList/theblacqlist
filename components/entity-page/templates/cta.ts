import type { EntityPageData } from '@/types'

/**
 * Business-defined primary CTA href with a real-destination guarantee.
 * Resolution order: "call" type + phone → tel:, owner cta_url, then
 * fallbacks for listings (typically unclaimed) with no configured CTA —
 * tel: (phone), mailto: (email), the Visit section anchor — and finally
 * null, which means "render no button" (never a dead href="#").
 */
export function getCtaHref(entity: EntityPageData): string | null {
  const { cta_type, cta_url, phone, email, address, hours } = entity.details

  if (cta_type === 'call' && phone) return `tel:${phone.replace(/\D/g, '')}`
  if (cta_url) return cta_url
  if (phone) return `tel:${phone.replace(/\D/g, '')}`
  if (email) return `mailto:${email}`
  if (address || hours) return '#visit'
  return null
}
