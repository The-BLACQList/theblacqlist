import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { OWNERSHIP_LABEL_META, type OwnershipLabel } from '@/lib/constants/listing'
import { resolveMediaPath } from '@/lib/listings/coverImage'
import { loadAttributeGroups, type FacetGroupData } from '@/lib/listings/facets'
import { buildEntityUrl } from '@/lib/listings/url'

// Everything the finish view needs for one business page (tickets 126 and 129).
// Both mounts call this: /add-business/finish/[listingId] (new mode) and the
// dashboard editor (edit mode), so the two can never drift apart.

export interface FinishDetails {
  description: string | null
  phone: string | null
  email: string | null
  website_url: string | null
  address_line_1: string | null
  address_line_2: string | null
  city_text: string | null
  state: string | null
  zip: string | null
  social_instagram: string | null
  social_facebook: string | null
  social_linkedin: string | null
  social_tiktok: string | null
  social_youtube: string | null
  social_twitter: string | null
  cta_type: string | null
  cta_url: string | null
  cta_label_override: string | null
  hours: Record<string, { open: string; close: string; closed: boolean }> | null
}

export interface FinishMedia {
  id: string
  file_path: string
  file_type: string
  alt_text: string | null
  display_order: number | null
}

export interface FinishService {
  id: string
  name: string
  description: string | null
  price_display: string | null
  is_featured: boolean | null
  display_order: number
  group_label?: string | null
}

export interface FinishData {
  id: string
  name: string
  status: string
  trustTier: string
  entityType: string
  tier: string | null
  tagline: string | null
  metaTitle: string | null
  metaDescription: string | null
  coverImagePath: string | null
  coverUrl: string | null
  ownershipLabel: string | null
  categoryName: string | null
  locationLabel: string | null
  publicUrl: string
  details: FinishDetails | null
  media: FinishMedia[]
  services: FinishService[]
  hoursCount: number
  attributeGroups: FacetGroupData[]
  selectedValueIds: string[]
  videoEmbedUrl: string | null
  /** Storage path of an uploaded video (ticket 130). A page has a link or a file, not both. */
  videoPath: string | null
  links: { id: string; link_type: string; url: string; label: string | null }[]
  faqs: { id: string; question: string; answer: string }[]
}

const DETAIL_COLUMNS = `
  description, phone, email, website_url,
  address_line_1, address_line_2, city_text, state, zip,
  social_instagram, social_facebook, social_linkedin,
  social_tiktok, social_youtube, social_twitter,
  cta_type, cta_url, cta_label_override,
  hours
`

/** Days with hours set and not marked closed. */
export function countOpenDays(hours: FinishDetails['hours']): number {
  if (!hours) return 0
  return Object.values(hours).filter((d) => d && !d.closed && d.open && d.close).length
}

/**
 * Load one business-shaped page (business, creative, service provider, vendor)
 * the signed-in owner owns. Returns null when the page does not exist, is
 * deleted, belongs to someone else, or is an event or job (those keep their
 * own editors).
 */
export async function loadFinishData(
  supabase: SupabaseClient,
  listingId: string,
  ownerUserId: string
): Promise<FinishData | null> {
  const { data: row } = await supabase
    .from('listings')
    .select(
      `id, name, slug, status, trust_tier, entity_type, tier, tagline,
       meta_title, meta_description, cover_image_path, ownership_label,
       categories!listings_category_id_fkey(name),
       cities!listings_city_id_fkey(slug, name, states!cities_state_id_fkey(code)),
       listing_details_business(${DETAIL_COLUMNS})`
    )
    .eq('id', listingId)
    .eq('owner_user_id', ownerUserId)
    .is('deleted_at', null)
    .maybeSingle()

  if (!row || row.entity_type === 'event' || row.entity_type === 'job') return null

  // Fail-soft reads: a section with no rows (or a table not yet migrated on a
  // branch database) shows empty instead of breaking the page.
  const [
    attributeGroups,
    { data: attrRows },
    { data: videoRow },
    { data: linkRows },
    { data: faqRows },
    { data: mediaRows },
    { data: serviceRows },
    { data: groupRows },
  ] = await Promise.all([
    loadAttributeGroups(supabase, row.entity_type),
    supabase.from('listing_attributes').select('value_id').eq('listing_id', row.id),
    supabase
      .from('listing_details_business')
      // '*' so a database without video_path (ticket 130) still loads the link.
      .select('*')
      .eq('listing_id', row.id)
      .maybeSingle(),
    supabase
      .from('listing_links')
      .select('id, link_type, url, label')
      .eq('listing_id', row.id)
      .order('display_order', { ascending: true }),
    supabase
      .from('listing_faqs')
      .select('id, question, answer')
      .eq('listing_id', row.id)
      .order('display_order', { ascending: true }),
    supabase
      .from('media_attachments')
      .select('id, file_path, file_type, alt_text, display_order')
      .eq('entity_id', row.id)
      .eq('entity_type', 'listing')
      .order('display_order', { ascending: true }),
    supabase
      .from('services')
      .select('id, name, description, price_display, is_featured, display_order')
      .eq('listing_id', row.id)
      .order('display_order', { ascending: true }),
    supabase.from('services').select('id, group_label').eq('listing_id', row.id),
  ])

  // One-to-one embeds come back as an object; guard the array shape too.
  const one = <T>(v: unknown): T | null =>
    (Array.isArray(v) ? (v[0] ?? null) : (v ?? null)) as T | null

  const details = one<FinishDetails>(row.listing_details_business)
  const category = one<{ name: string }>(row.categories)
  const city = one<{ slug: string; name: string; states: unknown }>(row.cities)
  const cityState = one<{ code: string }>(city?.states)

  const typedCity = city ? `${city.name}${cityState?.code ? `, ${cityState.code}` : ''}` : null
  const textCity = details?.city_text
    ? `${details.city_text}${details.state ? `, ${details.state}` : ''}`
    : null

  const groupById = new Map(
    ((groupRows as { id: string; group_label: string | null }[] | null) ?? []).map((g) => [
      g.id,
      g.group_label,
    ])
  )
  const services = ((serviceRows as FinishService[] | null) ?? []).map((s) => ({
    ...s,
    group_label: groupById.get(s.id) ?? null,
  }))

  const ownership = row.ownership_label as OwnershipLabel | null

  return {
    id: row.id,
    name: row.name,
    status: row.status,
    trustTier: row.trust_tier,
    entityType: row.entity_type,
    tier: row.tier ?? null,
    tagline: row.tagline ?? null,
    metaTitle: row.meta_title ?? null,
    metaDescription: row.meta_description ?? null,
    coverImagePath: row.cover_image_path ?? null,
    coverUrl: resolveMediaPath(row.cover_image_path),
    ownershipLabel: ownership ? (OWNERSHIP_LABEL_META[ownership]?.label ?? null) : null,
    categoryName: category?.name ?? null,
    locationLabel: typedCity ?? textCity,
    publicUrl: buildEntityUrl(row.entity_type, city?.slug, row.slug),
    details,
    media: (mediaRows as FinishMedia[] | null) ?? [],
    services,
    hoursCount: countOpenDays(details?.hours ?? null),
    attributeGroups,
    selectedValueIds: ((attrRows as { value_id: string }[] | null) ?? []).map((r) => r.value_id),
    videoEmbedUrl: (videoRow as { video_embed_url?: string | null } | null)?.video_embed_url ?? null,
    videoPath: (videoRow as { video_path?: string | null } | null)?.video_path ?? null,
    links:
      (linkRows as { id: string; link_type: string; url: string; label: string | null }[] | null) ??
      [],
    faqs: (faqRows as { id: string; question: string; answer: string }[] | null) ?? [],
  }
}
