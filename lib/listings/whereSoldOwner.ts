import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'
import { VALID_LOCATION_TYPES, type LocationType } from '@/lib/constants/listing'
import {
  STOCKIST_SELECT,
  toOrderLinks,
  toRetailChains,
  toStockists,
  type OrderLink,
  type RetailChain,
  type Stockist,
} from '@/lib/listings/whereSold'

// What the owner edit page needs for part D: the order links, the stores, the
// chain list and how the business operates. Read on the owner's own client, so
// RLS lets them see their own rows on a page that isn't published yet.

export interface OwnerWhereSold {
  orderLinks: OrderLink[]
  stockists: Stockist[]
  chains: RetailChain[]
  location: { locationType: LocationType; serviceArea: string | null; shipsNationwide: boolean }
}

/** Null when any read fails, so the cards hide rather than show an empty list. */
export async function loadOwnerWhereSold(
  supabase: SupabaseClient<Database>,
  listingId: string
): Promise<OwnerWhereSold | null> {
  const [links, stockists, chains, listing] = await Promise.all([
    supabase.from('listing_order_platforms').select('platform, url').eq('listing_id', listingId),
    supabase.from('listing_stockists').select(STOCKIST_SELECT).eq('listing_id', listingId),
    supabase.from('retail_chains').select('slug, name'),
    supabase
      .from('listings')
      .select(
        'location_type, service_area_description, ships_nationwide, listing_details_business(ships_nationwide)'
      )
      .eq('id', listingId)
      .maybeSingle(),
  ])
  if (links.error || stockists.error || chains.error || listing.error || !listing.data) return null

  const row = listing.data as {
    location_type: string
    service_area_description: string | null
    ships_nationwide: boolean | null
    listing_details_business:
      | { ships_nationwide: boolean | null }
      | { ships_nationwide: boolean | null }[]
      | null
  }
  const det = Array.isArray(row.listing_details_business)
    ? row.listing_details_business[0]
    : row.listing_details_business
  const locationType = (VALID_LOCATION_TYPES as readonly string[]).includes(row.location_type)
    ? (row.location_type as LocationType)
    : 'physical'

  return {
    orderLinks: toOrderLinks(links.data),
    stockists: toStockists(stockists.data),
    chains: toRetailChains(chains.data),
    location: {
      locationType,
      serviceArea: row.service_area_description,
      // The page reads the details row first (lib/listings/entityPage.ts).
      shipsNationwide: det?.ships_nationwide ?? row.ships_nationwide ?? false,
    },
  }
}
