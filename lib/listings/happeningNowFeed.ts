import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { isFeatureEnabled } from '@/lib/env'
import { resolveMediaPath } from '@/lib/listings/coverImage'
import { buildEntityUrl } from '@/lib/listings/url'
import {
  STRIP_LIMIT,
  shownPosts,
  toOwnerPosts,
  toPublicPost,
  type OwnerPost,
  type PublicPost,
} from '@/lib/listings/happeningNow'

// The "Happening now" strip on city and city + category pages (part F): live
// posts from published business pages there, soonest ending first, at most 8.
// A time-ordered feed: no ranking by plan or by Featured.
//
// Each page shows only the posts its plan allows (shownPosts). The query reads
// the 60 soonest ending live posts, which is far more than 8 pages' worth; a
// page with more live posts than that falls back to the ones read.

const READ_LIMIT = 60

export interface StripPost {
  post: PublicPost
  listing: { id: string; name: string; href: string; logoUrl: string | null }
}

interface FeedRow extends OwnerPost {
  listing_id: string
  listings: {
    id: string
    name: string
    slug: string
    entity_type: string
    tier: string | null
    logo_path: string | null
    cities: { slug: string } | null
  } | null
}

/** Live posts for a city, or a city and a category (its subcategories included). */
export async function loadHappeningNowFeed(opts: {
  cityId: string
  categoryId?: string
}): Promise<StripPost[]> {
  if (!isFeatureEnabled('happeningNow')) return []
  try {
    const supabase = (await createClient()) as unknown as SupabaseClient

    let categoryIds: string[] | null = null
    if (opts.categoryId) {
      const { data: children } = await supabase
        .from('categories')
        .select('id')
        .eq('parent_id', opts.categoryId)
      categoryIds = [
        opts.categoryId,
        ...((children as { id: string }[] | null) ?? []).map((c) => c.id),
      ]
    }

    const now = new Date()
    const nowIso = now.toISOString()
    let query = supabase
      .from('listing_posts')
      .select(
        `id, listing_id, headline, body, image_path, button_label, button_url, starts_at, ends_at, status, created_at,
         listings!inner(id, name, slug, entity_type, tier, logo_path, city_id, category_id, status, deleted_at,
           cities!listings_city_id_fkey(slug))`
      )
      .eq('status', 'active')
      .lte('starts_at', nowIso)
      .gt('ends_at', nowIso)
      .eq('listings.city_id', opts.cityId)
      .eq('listings.status', 'published')
      .is('listings.deleted_at', null)
      .not('listings.entity_type', 'in', '(job,event)')
    if (categoryIds) query = query.in('listings.category_id', categoryIds)
    const { data, error } = await query.order('ends_at', { ascending: true }).limit(READ_LIMIT)
    if (error || !Array.isArray(data)) return []

    return toStripPosts(data as unknown as FeedRow[], now)
  } catch {
    // Fail-soft: the strip is extra; the page renders without it.
    return []
  }
}

/** Applies each page's plan, then keeps the 8 ending soonest. Exported for tests. */
export function toStripPosts(rows: readonly FeedRow[], now: Date): StripPost[] {
  const byListing = new Map<string, FeedRow[]>()
  for (const row of rows) {
    if (!row.listings) continue
    const list = byListing.get(row.listing_id) ?? []
    list.push(row)
    byListing.set(row.listing_id, list)
  }

  const out: { post: OwnerPost; listing: NonNullable<FeedRow['listings']> }[] = []
  for (const list of byListing.values()) {
    const listing = list[0]?.listings
    if (!listing) continue
    const posts = toOwnerPosts(list)
    for (const post of shownPosts(posts, listing.tier, now).shown) out.push({ post, listing })
  }

  return out
    .sort((a, b) => Date.parse(a.post.ends_at) - Date.parse(b.post.ends_at))
    .slice(0, STRIP_LIMIT)
    .flatMap(({ post, listing }) => {
      const citySlug = listing.cities?.slug
      if (!citySlug) return []
      return [
        {
          post: toPublicPost(post, resolveMediaPath),
          listing: {
            id: listing.id,
            name: listing.name,
            href: buildEntityUrl(listing.entity_type, citySlug, listing.slug),
            logoUrl: resolveMediaPath(listing.logo_path),
          },
        },
      ]
    })
}
