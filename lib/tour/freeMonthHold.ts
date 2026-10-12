// Whether the upgrade page should hold back the paid checkout because a free
// month is still waiting for this listing.
//
// A tester clicked "Upgrade to Starter" right under a saved free month and
// landed on a $19-today Stripe page (founder, 2026-10-11). The regular
// checkout has no trial, and paying first would park the month until ticket
// 136. So while the month is unclaimed and could land on the page the plan
// cards act on, those cards point at the free month instead of charging.
//
// Kept apart from freeMonth.ts so the client plan cards can import the type
// without pulling in the Stripe and Supabase server code.

import type { FreeMonthState } from '@/lib/tour/freeMonth'

/** 'waiting': the month needs a live page first. 'ready': it can be used now. */
export type FreeMonthHold = 'waiting' | 'ready' | null

export function freeMonthHold(
  state: FreeMonthState | null,
  primaryListingId: string
): FreeMonthHold {
  if (!state) return null
  switch (state.status) {
    case 'waiting':
      return 'waiting'
    case 'ready':
      return state.listingId === primaryListingId ? 'ready' : null
    case 'pick':
      return state.pages.some((p) => p.listingId === primaryListingId && !p.paid) ? 'ready' : null
    default:
      // 'used' and 'saved': the month is spent or already waiting on a paid
      // plan, so the normal checkout stays.
      return null
  }
}
