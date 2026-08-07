import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolveCoverImage } from '@/lib/listings/coverImage'
import { buildEntityUrl } from '@/lib/listings/url'

export const revalidate = 900

interface Row {
  id: string
  name: string
  slug: string
  entity_type: string
  trust_tier: string
  logo_path: string | null
  avg_rating: number | null
  review_count: number
  is_featured: boolean
  is_sponsored: boolean
  cover_image_path: string | null
  categories: { name: string; slug: string } | null
  cities: { slug: string; name: string } | null
  listing_details_business: {
    lat: number | null
    lng: number | null
    hours: unknown
    price_range: string | null
  } | null
}

/**
 * All published, geocoded listings as GeoJSON for the map explore page.
 * A few hundred rows — the client filters and clusters; a bbox RPC comes
 * only when scale demands it. Photo URLs ship only for verified/certified
 * listings (the map tier ladder: prominence = trust, never pay).
 */
export async function GET() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('listings')
    .select(
      'id, name, slug, entity_type, trust_tier, logo_path, avg_rating, review_count, is_featured, is_sponsored, cover_image_path, categories!listings_category_id_fkey(name, slug), cities!listings_city_id_fkey(slug, name), listing_details_business(lat, lng, hours, price_range)'
    )
    .eq('status', 'published')
    .is('deleted_at', null)

  if (error) {
    return NextResponse.json({ error: 'Could not load map listings' }, { status: 500 })
  }

  const features = ((data ?? []) as unknown as Row[])
    .filter((row) => {
      const d = row.listing_details_business
      return d && typeof d.lat === 'number' && typeof d.lng === 'number'
    })
    .map((row) => {
      const d = row.listing_details_business!
      const showPhoto = row.trust_tier === 'verified' || row.trust_tier === 'certified'
      // Logo markers are a claimed+ feature (map-presence ladder level 2+)
      const showLogo = row.trust_tier !== 'unclaimed'
      const logoSrc =
        showLogo && row.logo_path
          ? row.logo_path.startsWith('http')
            ? row.logo_path
            : `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/listing-media/${row.logo_path}`
          : null
      return {
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [d.lng!, d.lat!] },
        properties: {
          id: row.id,
          name: row.name,
          entityType: row.entity_type,
          href: buildEntityUrl(row.entity_type, row.cities?.slug, row.slug),
          category: row.categories?.name ?? null,
          categorySlug: row.categories?.slug ?? null,
          citySlug: row.cities?.slug ?? null,
          cityName: row.cities?.name ?? null,
          trustTier: row.trust_tier,
          logoSrc,
          avgRating: row.avg_rating,
          reviewCount: row.review_count,
          isFeatured: row.is_featured,
          isSponsored: row.is_sponsored,
          priceRange: d.price_range,
          hours: d.hours ?? null,
          coverSrc: showPhoto
            ? resolveCoverImage(row.cover_image_path, row.entity_type, row.id).src
            : null,
        },
      }
    })

  return NextResponse.json(
    { type: 'FeatureCollection', features },
    { headers: { 'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=3600' } }
  )
}
