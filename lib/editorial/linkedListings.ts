// The businesses a BLACQLight story links to. There is no join table yet
// (ticket 118); a story features a business by linking to its page in the body,
// `[Peach & Rye](/houston/restaurant/peach-and-rye)`. This turns those links
// into listing rows, published listings only, in the order the story names
// them. Spec: page-workshop-2026-10-spec.md §3, Option A.

import { VALID_ENTITY_TYPES } from '@/lib/constants/listing'
import { buildEntityUrl } from '@/lib/listings/url'
import type { createClient } from '@/lib/supabase/server'
import { inlineHrefs } from './inline'

type Client = Awaited<ReturnType<typeof createClient>>

const LISTING_PATH = /^\/([a-z0-9-]+)\/([a-z_]+)\/([a-z0-9-]+)\/?$/

// Bounds the `.in()` list. Four stories rarely link more than a handful.
const MAX_SLUGS = 24

/** Listing slugs linked from the bodies, deduped, in first-seen order. */
export function linkedListingSlugs(bodies: readonly (string | null | undefined)[]): string[] {
  const slugs: string[] = []
  for (const body of bodies) {
    for (const { href, kind } of inlineHrefs(body ?? '')) {
      if (kind !== 'internal') continue
      const match = LISTING_PATH.exec(href)
      if (!match) continue
      const [, , entityType = '', slug = ''] = match
      if (!(VALID_ENTITY_TYPES as readonly string[]).includes(entityType)) continue
      if (!slugs.includes(slug)) slugs.push(slug)
    }
  }
  return slugs.slice(0, MAX_SLUGS)
}

export interface LinkedListing {
  id: string
  slug: string
  name: string
  href: string
  trustTier: string
  ownershipLabel: string
  category: string | null
  city: string | null
}

export interface LinkedListingRow {
  id: string
  slug: string
  name: string
  entity_type: string
  status: string
  deleted_at: string | null
  trust_tier: string
  ownership_label: string
  categories: { name: string } | null
  cities: { name: string; slug: string; states: { code: string } | null } | null
}

/**
 * Keep published, live rows and put them in the order the story linked them.
 * The query already filters on status; this re-checks so a row that slips
 * through (a widened select, a policy change) never reaches the page.
 */
export function orderLinkedListings(
  rows: readonly LinkedListingRow[],
  slugs: readonly string[],
  limit: number
): LinkedListing[] {
  const bySlug = new Map(
    rows.filter((r) => r.status === 'published' && r.deleted_at === null).map((r) => [r.slug, r])
  )
  return slugs
    .flatMap((slug) => {
      const r = bySlug.get(slug)
      if (!r) return []
      const state = r.cities?.states?.code
      return [
        {
          id: r.id,
          slug: r.slug,
          name: r.name,
          href: buildEntityUrl(r.entity_type, r.cities?.slug, r.slug),
          trustTier: r.trust_tier,
          ownershipLabel: r.ownership_label,
          category: r.categories?.name ?? null,
          city: r.cities ? (state ? `${r.cities.name}, ${state}` : r.cities.name) : null,
        },
      ]
    })
    .slice(0, limit)
}

/**
 * Load the linked listings for the given bodies. Fails soft: a query error
 * hides the strip instead of breaking the story around it.
 */
export async function loadLinkedListings(
  supabase: Client,
  bodies: readonly (string | null | undefined)[],
  limit: number
): Promise<LinkedListing[]> {
  const slugs = linkedListingSlugs(bodies)
  if (slugs.length === 0) return []

  const { data, error } = await supabase
    .from('listings')
    .select(
      `id, slug, name, entity_type, status, deleted_at, trust_tier, ownership_label,
       categories!listings_category_id_fkey(name),
       cities!listings_city_id_fkey(name, slug, states!cities_state_id_fkey(code))`
    )
    .in('slug', slugs)
    .eq('status', 'published')
    .is('deleted_at', null)

  if (error) {
    console.error('[blacqlight] linked listings query failed:', error.message)
    return []
  }
  return orderLinkedListings((data ?? []) as unknown as LinkedListingRow[], slugs, limit)
}
