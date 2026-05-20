import { createClient } from "@/lib/supabase/server"
import type {
  EntityPageData,
  BusinessDetails,
  WeeklyHours,
  SocialLinks,
  CTAType,
  GalleryImage,
  ReviewItem,
} from "@/types"
import type { DiscoveryEntity } from "@/types"

// Internal type matching the Supabase nested select result
type RawRow = {
  id: string
  slug: string
  name: string
  tagline: string | null
  entity_type: string
  location_type: string
  trust_tier: string
  tier: string
  is_featured: boolean
  is_sponsored: boolean
  logo_path: string | null
  cover_image_path: string | null
  avg_rating: number | null
  review_count: number
  save_count: number
  ships_nationwide: boolean
  owner_user_id: string | null
  category_id: string
  categories: { name: string; slug: string } | null
  cities: {
    name: string
    slug: string
    states: { code: string } | null
  } | null
  listing_details_business: {
    description: string | null
    address_line_1: string | null
    address_line_2: string | null
    city_text: string | null
    state: string | null
    zip: string | null
    phone: string | null
    email: string | null
    website_url: string | null
    social_instagram: string | null
    social_facebook: string | null
    social_linkedin: string | null
    social_tiktok: string | null
    social_youtube: string | null
    social_twitter: string | null
    cta_type: string
    cta_url: string | null
    cta_label_override: string | null
    hours: unknown
    ships_nationwide: boolean
  } | null
}

const LISTING_SELECT = `
  id, slug, name, tagline, entity_type, location_type, trust_tier, tier,
  is_featured, is_sponsored, logo_path, cover_image_path,
  avg_rating, review_count, save_count, ships_nationwide, owner_user_id, category_id,
  categories!listings_category_id_fkey(name, slug),
  cities!listings_city_id_fkey(
    name, slug,
    states!cities_state_id_fkey(code)
  ),
  listing_details_business(
    description, address_line_1, address_line_2, city_text,
    state, zip, phone, email, website_url,
    social_instagram, social_facebook, social_linkedin,
    social_tiktok, social_youtube, social_twitter,
    cta_type, cta_url, cta_label_override, hours, ships_nationwide
  )
`

function toDiscoveryEntity(raw: RawRow): DiscoveryEntity {
  return {
    id: raw.id,
    slug: raw.slug,
    name: raw.name,
    tagline: raw.tagline ?? "",
    description: raw.listing_details_business?.description ?? "",
    entity_type: raw.entity_type as DiscoveryEntity["entity_type"],
    location_type: raw.location_type as DiscoveryEntity["location_type"],
    trust_tier: raw.trust_tier as DiscoveryEntity["trust_tier"],
    tier: raw.tier as DiscoveryEntity["tier"],
    is_featured: raw.is_featured,
    is_sponsored: raw.is_sponsored,
    logo_path: raw.logo_path,
    cover_image_path: raw.cover_image_path,
    avg_rating: raw.avg_rating,
    review_count: raw.review_count,
    save_count: raw.save_count,
    category: raw.categories ?? { name: "General", slug: "general" },
    city: raw.cities
      ? { name: raw.cities.name, slug: raw.cities.slug, state_abbr: raw.cities.states?.code ?? "" }
      : null,
  }
}

export async function getEntityPageFromDB(slug: string): Promise<EntityPageData | null> {
  const supabase = await createClient()

  const { data } = await supabase
    .from("listings")
    .select(LISTING_SELECT)
    .eq("slug", slug)
    .eq("status", "published")
    .is("deleted_at", null)
    .maybeSingle()

  if (!data) return null
  const raw = data as unknown as RawRow

  const [
    { data: servicesData },
    { data: mediaData },
    { data: reviewsData },
    { data: relatedData },
  ] = await Promise.all([
    supabase
      .from("services")
      .select("id, name, description, price_display, display_order")
      .eq("listing_id", raw.id)
      .is("deleted_at", null)
      .order("display_order"),
    supabase
      .from("media_attachments")
      .select("id, file_path, alt_text, display_order")
      .eq("entity_type", "listing")
      .eq("entity_id", raw.id)
      .eq("is_approved", true)
      .order("display_order"),
    supabase
      .from("reviews")
      .select("id, rating, title, body, published_at, is_verified_purchase, reviewer_user_id, owner_response, owner_responded_at")
      .eq("listing_id", raw.id)
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(10),
    supabase
      .from("listings")
      .select(LISTING_SELECT)
      .eq("category_id", raw.category_id)
      .eq("status", "published")
      .is("deleted_at", null)
      .neq("id", raw.id)
      .order("save_count", { ascending: false })
      .limit(6),
  ])

  const reviewerIds = (reviewsData ?? [])
    .map((r) => r.reviewer_user_id)
    .filter((id): id is string => !!id)
  const reviewerNameMap: Record<string, string> = {}
  if (reviewerIds.length > 0) {
    const { data: reviewerProfiles } = await supabase
      .from("profiles")
      .select("id, display_name")
      .in("id", reviewerIds)
    for (const p of reviewerProfiles ?? []) {
      if (p.display_name) reviewerNameMap[p.id] = p.display_name
    }
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""
  const images: GalleryImage[] = (mediaData ?? []).map((m) => ({
    id: m.id,
    src: `${supabaseUrl}/storage/v1/object/public/listing-media/${m.file_path}`,
    alt: m.alt_text ?? "",
  }))

  const reviews: ReviewItem[] = (reviewsData ?? []).map((r) => ({
    id: r.id,
    rating: r.rating,
    title: r.title ?? null,
    body: r.body ?? null,
    published_at: r.published_at ?? null,
    is_verified_purchase: r.is_verified_purchase,
    reviewer_display_name: r.reviewer_user_id ? (reviewerNameMap[r.reviewer_user_id] ?? null) : null,
    owner_response: r.owner_response ?? null,
    owner_responded_at: r.owner_responded_at ?? null,
  }))

  const det = raw.listing_details_business
  const cityData = raw.cities

  const details: BusinessDetails = {
    description: det?.description ?? "",
    address: det?.address_line_1 ?? null,
    address_line2: det?.address_line_2 ?? null,
    city_name: det?.city_text ?? cityData?.name ?? null,
    state_abbr: det?.state ?? cityData?.states?.code ?? null,
    zip: det?.zip ?? null,
    phone: det?.phone ?? null,
    email: det?.email ?? null,
    website_url: det?.website_url ?? null,
    social: {
      instagram: det?.social_instagram ?? null,
      facebook: det?.social_facebook ?? null,
      linkedin: det?.social_linkedin ?? null,
      tiktok: det?.social_tiktok ?? null,
      youtube: det?.social_youtube ?? null,
      twitter: det?.social_twitter ?? null,
    } as SocialLinks,
    cta_type: (det?.cta_type ?? "learn-more") as CTAType,
    cta_url: det?.cta_url ?? null,
    cta_label_override: det?.cta_label_override ?? null,
    ships_nationwide: det?.ships_nationwide ?? raw.ships_nationwide,
    hours: (det?.hours as WeeklyHours | null) ?? null,
    services: (servicesData ?? []).map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description ?? "",
      price: s.price_display,
    })),
  }

  return {
    id: raw.id,
    slug: raw.slug,
    name: raw.name,
    tagline: raw.tagline ?? "",
    entity_type: raw.entity_type as EntityPageData["entity_type"],
    location_type: raw.location_type as EntityPageData["location_type"],
    trust_tier: raw.trust_tier as EntityPageData["trust_tier"],
    tier: raw.tier as EntityPageData["tier"],
    is_featured: raw.is_featured,
    is_sponsored: raw.is_sponsored,
    logo_path: raw.logo_path,
    cover_image_path: raw.cover_image_path,
    avg_rating: raw.avg_rating,
    review_count: raw.review_count,
    save_count: raw.save_count,
    owner_user_id: raw.owner_user_id,
    category: raw.categories ?? { name: "General", slug: "general" },
    city: cityData
      ? { name: cityData.name, slug: cityData.slug, state_abbr: cityData.states?.code ?? "" }
      : null,
    details,
    related: (relatedData ?? []).map((r) => toDiscoveryEntity(r as unknown as RawRow)),
    images,
    reviews,
  }
}
