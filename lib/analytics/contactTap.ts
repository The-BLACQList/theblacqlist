/**
 * Contact taps on a listing page: website, call and directions (ticket 123).
 *
 * These feed the weekly Featured score, and the owner dashboard's CTA counts.
 * Email and in-page anchors (#visit) are not contact taps: the founder's list
 * was website, call and directions, so they are not sent at all.
 *
 * Client-safe and pure apart from `track()`.
 */

import { track } from '@/lib/analytics/client'
import { ANALYTICS_EVENTS } from '@/lib/analytics/constants'

export type ContactKind = 'website' | 'call' | 'directions'

/** Where on the page the tap happened. Each maps to one event name. */
export type ContactSource = 'hero' | 'action_bar' | 'at_a_glance'

const EVENT_BY_SOURCE = {
  hero: ANALYTICS_EVENTS.HERO_CTA_CLICK,
  action_bar: ANALYTICS_EVENTS.ACTION_BAR_CTA_CLICK,
  at_a_glance: ANALYTICS_EVENTS.CTA_CLICK,
} as const satisfies Record<ContactSource, string>

const MAPS = /^https?:\/\/((www\.)?google\.[a-z.]+\/maps|maps\.google\.[a-z.]+|maps\.apple\.com)/i

/** What a link is, from its href, or null when it isn't a contact tap. */
export function contactKind(href: string): ContactKind | null {
  if (/^tel:/i.test(href)) return 'call'
  if (MAPS.test(href)) return 'directions'
  if (/^https?:\/\//i.test(href)) return 'website'
  return null
}

export function trackContactTap(listingId: string, href: string, source: ContactSource): void {
  const kind = contactKind(href)
  if (!kind) return
  track({
    event_name: EVENT_BY_SOURCE[source],
    entity_type: 'listing',
    entity_id: listingId,
    properties: { kind, source },
  })
}
