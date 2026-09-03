import type { EntityPageData } from '@/types'

/**
 * Business-defined primary CTA href with a real-destination guarantee.
 * Resolution order: "call" type + phone → tel:, owner cta_url, then
 * fallbacks for listings (typically unclaimed) with no configured CTA —
 * tel: (phone), mailto: (email), the Visit section anchor — and finally
 * null, which means "render no button" (never a dead href="#").
 *
 * The '#visit' step is guarded by entity_type, because that anchor is not
 * universal. It sits on the At a Glance block: the two Living Commerce Index
 * templates carry it (gated by their own `hasVisit`, which is a superset of the
 * address-or-hours test here, so it is always present when this returns it) and
 * the default listing page carries it too. Events and jobs render
 * EntityEventDetails / EntityJobDetails instead and have **no** Visit section —
 * returning '#visit' for them would swap the old dead `href="#"` for a new dead
 * `href="#visit"`. For those two an unconfigured CTA correctly resolves to null
 * and no button is rendered at all.
 */
export function getCtaHref(entity: EntityPageData): string | null {
  const { cta_type, cta_url, phone, email, address, hours } = entity.details

  if (cta_type === 'call' && phone) return `tel:${phone.replace(/\D/g, '')}`
  if (cta_url) return cta_url
  if (phone) return `tel:${phone.replace(/\D/g, '')}`
  if (email) return `mailto:${email}`

  const hasVisitSection = entity.entity_type !== 'event' && entity.entity_type !== 'job'
  if (hasVisitSection && (address || hours)) return '#visit'

  return null
}
