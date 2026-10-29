import { canAccess, TIER_RANK } from '@/lib/stripe/features'

// Ticket 105. Which pages' products and services the public can see.
//
// [Decision — founder, 2026-10-28] a page that moves below Growth keeps its
// products and services, hidden on the public marketplace, never deleted. They
// come back the moment the page is on Growth or Premium again.
//
// Unlike photos or FAQs this is not a cap after a downgrade: a storefront is a
// Growth feature (canAccess(tier, 'storefront')), so a page below Growth shows
// none. No page could add one below Growth, so this hides nothing that was
// never sold.
//
// The public marketplace pages read through the service client, which skips
// RLS, so each of them filters on these tiers itself. Migration
// 20261028000000 applies the same rule in RLS for every other reader.

/** Tiers whose products and services are public. Matches the RLS policy. */
export const STOREFRONT_TIERS = Object.keys(TIER_RANK).filter((t) => canAccess(t, 'storefront'))

/** True when this page's products and services show on the public marketplace. */
export function sellsPublicly(tier: string | null | undefined): boolean {
  return canAccess(tier ?? null, 'storefront')
}
