import 'server-only'

import { isFeatureEnabled } from '@/lib/env'
import { resolveRemoteImage } from '@/lib/listings/coverImage'
import { productPriceLabel, servicePriceLabel } from '@/lib/marketplace/priceLabel'
import { sellsPublicly } from '@/lib/marketplace/visibility'
import { createServiceClient } from '@/lib/supabase/server'
import type { EntityShop, EntityShopItem } from '@/types'

// Ticket 186. The Shop section on a business's own page: a few of the
// products and services it sells in the marketplace, and a link to the rest
// at /vendors/{slug}.
//
// Read the way the vendor page reads (app/(public)/vendors/[slug]/page.tsx):
// the service client, active rows only, and the plan filter applied here
// because the service client skips the RLS rule that applies it for everyone
// else (lib/marketplace/visibility.ts, ticket 105).

/** Items of each kind the section shows. "Shop All (N)" counts the rest. */
export const PROFILE_SHOP_MAX = 6

export interface ProfileProductRow {
  id: string
  name: string
  global_slug: string | null
  price_cents: number | null
  price_display_text: string | null
  cover_image_url: string | null
}

export interface ProfileServiceRow {
  id: string
  name: string
  global_slug: string | null
  starting_price_cents: number | null
  price_display_text: string | null
  cover_image_url: string | null
}

const PRODUCT_SELECT = 'id, name, global_slug, price_cents, price_display_text, cover_image_url'
const SERVICE_SELECT =
  'id, name, global_slug, starting_price_cents, price_display_text, cover_image_url'

function shopImage(url: string | null, name: string): EntityShopItem['image'] {
  const remote = resolveRemoteImage(url)
  if (!remote) return null
  return remote.unoptimized
    ? { src: remote.src, alt: name, unoptimized: true }
    : { src: remote.src, alt: name }
}

/**
 * Rows to the section's cards: products first, then services, each capped at
 * PROFILE_SHOP_MAX. A row with no global_slug has no page to link to, so it is
 * left out rather than linking nowhere. Null when nothing is left to show.
 */
export function toProfileShop(input: {
  slug: string
  products: ProfileProductRow[]
  services: ProfileServiceRow[]
  /** Active items in all, which can exceed what is shown. */
  total: number
}): EntityShop | null {
  const products: EntityShopItem[] = input.products
    .filter((p) => p.global_slug)
    .slice(0, PROFILE_SHOP_MAX)
    .map((p) => ({
      id: p.id,
      kind: 'product',
      name: p.name,
      priceLabel: productPriceLabel(p),
      image: shopImage(p.cover_image_url, p.name),
      href: `/marketplace/products/${encodeURIComponent(p.global_slug!)}`,
    }))
  const services: EntityShopItem[] = input.services
    .filter((s) => s.global_slug)
    .slice(0, PROFILE_SHOP_MAX)
    .map((s) => ({
      id: s.id,
      kind: 'service',
      name: s.name,
      priceLabel: servicePriceLabel(s),
      image: shopImage(s.cover_image_url, s.name),
      href: `/marketplace/services/${encodeURIComponent(s.global_slug!)}`,
    }))
  const items = [...products, ...services]
  if (items.length === 0) return null
  return {
    items,
    total: Math.max(input.total, items.length),
    shopAllHref: `/vendors/${encodeURIComponent(input.slug)}`,
  }
}

/**
 * Whether this page may show a Shop at all: the marketplace is open on this
 * deployment (it links to /marketplace and /vendors, which show "opening
 * soon" while it is closed) and the plan includes a storefront (Growth+).
 * Jobs and events have no Shop section.
 */
export function profileShopShows(listing: { tier: string | null; entity_type: string }): boolean {
  if (listing.entity_type === 'job' || listing.entity_type === 'event') return false
  return isFeatureEnabled('marketplaceOpen') && sellsPublicly(listing.tier)
}

/**
 * The Shop for a live page, or null. Fail-soft: a read error hides the
 * section and leaves the rest of the page alone.
 */
export async function loadProfileShop(listing: {
  id: string
  slug: string
  tier: string | null
  entity_type: string
}): Promise<EntityShop | null> {
  if (!profileShopShows(listing)) return null
  try {
    const sb = createServiceClient()
    const [products, services] = await Promise.all([
      sb
        .from('marketplace_products')
        .select(PRODUCT_SELECT, { count: 'exact' })
        .eq('listing_id', listing.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(PROFILE_SHOP_MAX),
      sb
        .from('marketplace_services')
        .select(SERVICE_SELECT, { count: 'exact' })
        .eq('listing_id', listing.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(PROFILE_SHOP_MAX),
    ])
    if (products.error || services.error) return null
    return toProfileShop({
      slug: listing.slug,
      products: (products.data ?? []) as ProfileProductRow[],
      services: (services.data ?? []) as ProfileServiceRow[],
      total: (products.count ?? 0) + (services.count ?? 0),
    })
  } catch {
    return null
  }
}
