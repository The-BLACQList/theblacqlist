import type { EntityPageData } from '@/types'
import { getCtaLabel } from '@/types'
import { messagingCtaLabel } from '@/lib/messaging/rules'

/**
 * Business-defined primary CTA href with a real-destination guarantee.
 * Resolution order: "call" type + phone → tel:, "email" → mailto:,
 * "message" with in-app messaging → the viewer's messaging href (or null when
 * unavailable), owner cta_url, then
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
  // "Email us" stores a bare address (or, from older rows, a mailto: link).
  if (cta_type === 'email') {
    const address = cta_url && !hasScheme(cta_url) ? cta_url : null
    if (address) return `mailto:${address}`
    if (cta_url?.startsWith('mailto:')) return cta_url
    return email ? `mailto:${email}` : null
  }
  if (cta_type === 'message' && isLegacyMessageEmail(entity)) return `mailto:${cta_url}`
  // In-app messaging (2026-11-13). When the page resolved it for this viewer,
  // it replaces the old link entirely — including null for a closed inbox,
  // where the hero shows "Not accepting messages" in place of the button.
  if (cta_type === 'message' && entity.messaging) return entity.messaging.href
  if (cta_url) return cta_url
  if (phone) return `tel:${phone.replace(/\D/g, '')}`
  if (email) return `mailto:${email}`

  const hasVisitSection = entity.entity_type !== 'event' && entity.entity_type !== 'job'
  if (hasVisitSection && (address || hours)) return '#visit'

  return null
}

function hasScheme(value: string): boolean {
  return /^[a-z][a-z0-9+.-]*:/i.test(value)
}

/**
 * Before "Email us" existed, "Send a message" stored an email address and was a
 * mailto: button. Migration 20261113000004 moves those rows to 'email'. Until it
 * runs (and for any page with messaging off), such a row stays a mailto: unless
 * the owner has opened the inbox, so no page turns into "Not accepting messages".
 */
function isLegacyMessageEmail(entity: EntityPageData): boolean {
  const { cta_type, cta_url } = entity.details
  if (cta_type !== 'message' || !cta_url || hasScheme(cta_url) || !cta_url.includes('@')) return false
  return !entity.messaging || entity.messaging.mode === 'unavailable'
}

/** The CTA label, adjusted when the message CTA is in-app ("View inbox" for the owner). */
export function getEntityCtaLabel(entity: EntityPageData): string {
  if (isLegacyMessageEmail(entity)) return getCtaLabel('email', entity.details.cta_label_override)
  const label = getCtaLabel(entity.details.cta_type, entity.details.cta_label_override)
  if (entity.details.cta_type === 'message' && entity.messaging) {
    return messagingCtaLabel(entity.messaging.mode, label)
  }
  return label
}

/** The message CTA is in-app and this viewer cannot use it: show the closed state. */
export function isMessagingUnavailable(entity: EntityPageData): boolean {
  return (
    entity.details.cta_type === 'message' &&
    entity.messaging?.mode === 'unavailable' &&
    !isLegacyMessageEmail(entity)
  )
}

/**
 * A secondary "Message" button for a claimed listing whose main CTA is something
 * else (call, book, website). null when there is nothing a customer can do.
 * The owner does not get one: they have the dashboard.
 */
export function getSecondaryMessageHref(entity: EntityPageData): string | null {
  if ((entity.details.cta_type === 'message' && !isLegacyMessageEmail(entity)) || !entity.messaging) return null
  const { mode, href } = entity.messaging
  return mode === 'compose' || mode === 'sign_in' || mode === 'thread' ? href : null
}
