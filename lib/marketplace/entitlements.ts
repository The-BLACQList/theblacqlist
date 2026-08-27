import { canAccess, isAtLimit, productLimit } from '@/lib/stripe/features'
import { createServiceClient } from '@/lib/supabase/server'

/**
 * Marketplace entitlement resolution — the one place that answers "may this
 * listing add another marketplace item, and how many does it have left?"
 *
 * Two things this file exists to keep straight:
 *
 * 1. `TierLimits.products` is **products + services combined** (see its docblock
 *    in `lib/stripe/features.ts`). There is no separate service limit, so the
 *    counter has to span both tables or the cap is silently double.
 * 2. The limit is per *listing*, not per owner, because `tier` lives on
 *    `listings.tier` — an owner with two listings on different tiers gets two
 *    different allowances.
 *
 * Both create actions call `assertCanAddMarketplaceItem()` and both "new" pages
 * call `marketplaceAllowances()` so the owner is told what their tier allows
 * *before* the form rather than rejected after it. The server-side check is the
 * enforcement; the page-side read is only the message.
 */

/** Rows in these statuses do not occupy a slot. */
const FREED_STATUSES = ['archived']

export interface MarketplaceAllowance {
  listingId: string
  tier: string | null
  /** `null` means unlimited. */
  limit: number | null
  used: number
  /** False when the tier has no storefront at all — a different message from "you are full". */
  tierIncludesStorefront: boolean
  canAddMore: boolean
}

function allowanceFor(
  listingId: string,
  tier: string | null,
  used: number
): MarketplaceAllowance {
  const tierIncludesStorefront = canAccess(tier, 'storefront')
  const limit = productLimit(tier)
  return {
    listingId,
    tier,
    limit,
    used,
    tierIncludesStorefront,
    canAddMore: tierIncludesStorefront && !isAtLimit(tier, 'products', used),
  }
}

/**
 * Count non-archived marketplace rows per listing, across both tables.
 *
 * Uses the service client deliberately: the caller has already proven ownership
 * (or is rendering the owner's own dashboard), and a counter that silently reads
 * short because of an RLS policy change would fail *open* — the one direction a
 * limit must never fail. A read error propagates as `null` so callers can fail
 * closed, mirroring `countRecentRequests()` in `lib/ai/provider.ts`.
 */
async function countItemsByListing(listingIds: string[]): Promise<Record<string, number> | null> {
  if (listingIds.length === 0) return {}

  const supabase = createServiceClient()
  const [products, services] = await Promise.all([
    supabase
      .from('marketplace_products')
      .select('listing_id')
      .in('listing_id', listingIds)
      .not('status', 'in', `(${FREED_STATUSES.join(',')})`),
    supabase
      .from('marketplace_services')
      .select('listing_id')
      .in('listing_id', listingIds)
      .not('status', 'in', `(${FREED_STATUSES.join(',')})`),
  ])

  if (products.error || services.error) return null

  const counts: Record<string, number> = {}
  for (const id of listingIds) counts[id] = 0
  for (const row of [...(products.data ?? []), ...(services.data ?? [])]) {
    const id = row.listing_id as string
    counts[id] = (counts[id] ?? 0) + 1
  }
  return counts
}

/** Allowances for a set of listings the caller already owns. Order is preserved. */
export async function marketplaceAllowances(
  listings: { id: string; tier: string | null }[]
): Promise<MarketplaceAllowance[]> {
  const counts = await countItemsByListing(listings.map((l) => l.id))

  return listings.map((l) => {
    // Fail closed: an unreadable counter reports the listing as full rather than
    // empty, so a database blip cannot hand out unmetered marketplace slots.
    const used = counts === null ? Number.MAX_SAFE_INTEGER : (counts[l.id] ?? 0)
    return allowanceFor(l.id, l.tier, used)
  })
}

export type AddItemRefusal = { error: string; fieldErrors?: Partial<Record<string, string>> }

/**
 * The enforcement call. Returns `null` when the item may be created, or the
 * refusal object the server action should return verbatim.
 *
 * `kind` only shapes the wording — the slot is the same slot either way.
 */
export async function assertCanAddMarketplaceItem(
  listingId: string,
  tier: string | null,
  kind: 'product' | 'service'
): Promise<AddItemRefusal | null> {
  const [allowance] = await marketplaceAllowances([{ id: listingId, tier }])
  if (!allowance) return { error: 'Could not check your plan. Please try again.' }
  if (allowance.canAddMore) return null

  if (!allowance.tierIncludesStorefront) {
    return {
      error: `Your current plan does not include a marketplace storefront. Upgrade to Growth to list ${kind === 'product' ? 'products' : 'services'}.`,
      fieldErrors: { listing_id: 'This business page is not on a plan that includes a storefront.' },
    }
  }

  return {
    error: `This business page has used all ${allowance.limit} of its marketplace listings. Archive one, or upgrade for more room.`,
    fieldErrors: { listing_id: 'No marketplace slots left on this business page.' },
  }
}
