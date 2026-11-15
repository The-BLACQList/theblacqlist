import type { EntityType } from '@/types'

// "Open to partnerships" wording (ticket 134). The owner turns the switch on
// in the dashboard (PartnershipSection). Text always travels with an icon on
// screen, never color or an icon alone.
// [Decision — founder, 2026-10-20] Cards say "Open to partnerships", creators
// say "Open to brand deals", and the page spells it out in full.

/** The short card pill. Null when the switch is off. */
export function partnershipPill(entityType: EntityType, open: boolean | undefined): string | null {
  if (!open) return null
  // A badge, so Title Case (ticket 205); the info rail line below is a sentence.
  return entityType === 'creator' ? 'Open to Brand Deals' : 'Open to Partnerships'
}

/** The longer line on the page's info rail. Null when the switch is off. */
export function partnershipLine(entityType: EntityType, open: boolean | undefined): string | null {
  if (!open) return null
  return entityType === 'creator'
    ? 'Open to brand deals'
    : 'Open to creator partnerships and sponsorships'
}
