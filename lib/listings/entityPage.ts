import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { buildEntityUrl } from '@/lib/listings/url'
import type {
  EntityPageData,
  EntityAttributeGroup,
  EntityLink,
  EntityFaq,
  EventDetails,
  JobDetails,
  OrganizerEvent,
  BusinessDetails,
  WeeklyHours,
  SocialLinks,
  CTAType,
  GalleryImage,
  ReviewItem,
  ReviewCriterion,
  ReviewCriterionAverage,
} from '@/types'
import type { DiscoveryEntity } from '@/types'

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
  ownership_label: string
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
  ownership_label,
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
    tagline: raw.tagline ?? '',
    description: raw.listing_details_business?.description ?? '',
    entity_type: raw.entity_type as DiscoveryEntity['entity_type'],
    location_type: raw.location_type as DiscoveryEntity['location_type'],
    trust_tier: raw.trust_tier as DiscoveryEntity['trust_tier'],
    tier: raw.tier as DiscoveryEntity['tier'],
    ownership_label: raw.ownership_label as DiscoveryEntity['ownership_label'],
    is_featured: raw.is_featured,
    is_sponsored: raw.is_sponsored,
    logo_path: raw.logo_path,
    cover_image_path: raw.cover_image_path,
    avg_rating: raw.avg_rating,
    review_count: raw.review_count,
    save_count: raw.save_count,
    category: raw.categories ?? { name: 'General', slug: 'general' },
    city: raw.cities
      ? { name: raw.cities.name, slug: raw.cities.slug, state_abbr: raw.cities.states?.code ?? '' }
      : null,
  }
}

export async function getEntityPageFromDB(slug: string): Promise<EntityPageData | null> {
  const supabase = await createClient()

  const { data } = await supabase
    .from('listings')
    .select(LISTING_SELECT)
    .eq('slug', slug)
    .eq('status', 'published')
    .is('deleted_at', null)
    .maybeSingle()

  if (!data) return null
  const raw = data as unknown as RawRow

  const sb = supabase as unknown as SupabaseClient
  const [
    { data: servicesData },
    { data: mediaData },
    { data: reviewsData },
    { data: relatedData },
    { data: attrData },
    { data: videoData },
    { data: serviceGroupData },
    { data: linksData },
    { data: faqData },
    { data: criteriaData },
  ] = await Promise.all([
    supabase
      .from('services')
      .select('id, name, description, price_display, display_order')
      .eq('listing_id', raw.id)
      .is('deleted_at', null)
      .order('display_order'),
    supabase
      .from('media_attachments')
      .select('id, file_path, alt_text, display_order')
      .eq('entity_type', 'listing')
      .eq('entity_id', raw.id)
      .eq('is_approved', true)
      .order('display_order'),
    supabase
      .from('reviews')
      .select(
        'id, rating, title, body, published_at, is_verified_purchase, reviewer_user_id, owner_response, owner_responded_at'
      )
      .eq('listing_id', raw.id)
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(10),
    supabase
      .from('listings')
      .select(LISTING_SELECT)
      .eq('category_id', raw.category_id)
      .eq('status', 'published')
      .is('deleted_at', null)
      .neq('id', raw.id)
      .order('save_count', { ascending: false })
      .limit(6),
    sb
      .from('listing_attributes')
      .select(
        `attribute_values(
          name, slug, icon, display_order, group_id,
          attribute_groups(name, slug, display_order)
        )`
      )
      .eq('listing_id', raw.id),
    // Fail-soft: video_embed_url may not be migrated yet — queried separately so
    // its absence can't break the page (returns { data: null } on error).
    sb
      .from('listing_details_business')
      .select('video_embed_url')
      .eq('listing_id', raw.id)
      .maybeSingle(),
    // Fail-soft: services.group_label may not be migrated yet — queried separately
    // so offerings still render flat until the column exists.
    sb.from('services').select('id, group_label').eq('listing_id', raw.id),
    // Owner-managed flexible links (booking, menu, order, socials, …). Separate
    // query so an empty/missing set never affects the rest of the page.
    sb
      .from('listing_links')
      .select('id, link_type, url, label, display_order')
      .eq('listing_id', raw.id)
      .order('display_order', { ascending: true }),
    // Fail-soft: listing_faqs may not be migrated yet — queried separately so its
    // absence returns { data: null } and the page still renders.
    sb
      .from('listing_faqs')
      .select('id, question, answer, display_order, is_visible')
      .eq('listing_id', raw.id)
      .eq('is_visible', true)
      .order('display_order', { ascending: true }),
    // Fail-soft: review_criteria may not be migrated yet — drives the optional
    // per-criterion rows in the review form and the category-average summary.
    sb
      .from('review_criteria')
      .select('id, name, display_order')
      .eq('is_active', true)
      .order('display_order', { ascending: true }),
  ])

  // Group the listing's attributes for display (Identity & Ownership, Amenities, …).
  type AttrRow = {
    attribute_values: {
      name: string
      slug: string
      icon: string | null
      display_order: number
      attribute_groups: { name: string; slug: string; display_order: number } | null
    } | null
  }
  const attrGroupMap = new Map<
    string,
    { name: string; order: number; values: { name: string; slug: string; icon: string | null; order: number }[] }
  >()
  for (const row of (attrData as AttrRow[] | null) ?? []) {
    const v = row.attribute_values
    const g = v?.attribute_groups
    if (!v || !g) continue
    if (!attrGroupMap.has(g.slug)) {
      attrGroupMap.set(g.slug, { name: g.name, order: g.display_order, values: [] })
    }
    attrGroupMap.get(g.slug)!.values.push({
      name: v.name,
      slug: v.slug,
      icon: v.icon,
      order: v.display_order,
    })
  }
  const attributes: EntityAttributeGroup[] = Array.from(attrGroupMap.values())
    .sort((a, b) => a.order - b.order)
    .map((g) => ({
      group: g.name,
      values: g.values
        .sort((a, b) => a.order - b.order)
        .map(({ name, slug, icon }) => ({ name, slug, icon })),
    }))

  const reviewerIds = (reviewsData ?? [])
    .map((r) => r.reviewer_user_id)
    .filter((id): id is string => !!id)
  const reviewerNameMap: Record<string, string> = {}
  if (reviewerIds.length > 0) {
    const { data: reviewerProfiles } = await supabase
      .from('profiles')
      .select('id, display_name')
      .in('id', reviewerIds)
    for (const p of reviewerProfiles ?? []) {
      if (p.display_name) reviewerNameMap[p.id] = p.display_name
    }
  }

  // Per-criterion review scores for the published reviews we display. Fail-soft:
  // if review_ratings isn't migrated, every review simply shows no breakdown.
  const reviewIds = (reviewsData ?? []).map((r) => r.id)
  const reviewCriteriaMap = new Map<string, { name: string; rating: number; order: number }[]>()
  const criteriaAgg = new Map<string, { name: string; order: number; sum: number; count: number }>()
  const reviewPhotoMap = new Map<string, GalleryImage[]>()
  if (reviewIds.length > 0) {
    const storageBase = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
    const [{ data: ratingsData }, { data: reviewMedia }] = await Promise.all([
      sb
        .from('review_ratings')
        .select('review_id, rating, review_criteria(name, display_order)')
        .in('review_id', reviewIds),
      // Approved review photos only (RLS also gates on the review being published).
      supabase
        .from('media_attachments')
        .select('id, entity_id, file_path, alt_text')
        .eq('entity_type', 'review')
        .in('entity_id', reviewIds)
        .eq('is_approved', true)
        .order('created_at', { ascending: true }),
    ])
    type RatingRow = {
      review_id: string
      rating: number
      review_criteria: { name: string; display_order: number } | null
    }
    for (const row of (ratingsData as RatingRow[] | null) ?? []) {
      const c = row.review_criteria
      if (!c) continue
      const list = reviewCriteriaMap.get(row.review_id) ?? []
      list.push({ name: c.name, rating: row.rating, order: c.display_order })
      reviewCriteriaMap.set(row.review_id, list)
      const agg = criteriaAgg.get(c.name) ?? {
        name: c.name,
        order: c.display_order,
        sum: 0,
        count: 0,
      }
      agg.sum += row.rating
      agg.count += 1
      criteriaAgg.set(c.name, agg)
    }
    for (const m of (reviewMedia ?? []) as {
      id: string
      entity_id: string
      file_path: string
      alt_text: string | null
    }[]) {
      const list = reviewPhotoMap.get(m.entity_id) ?? []
      list.push({
        id: m.id,
        src: `${storageBase}/storage/v1/object/public/listing-media/${m.file_path}`,
        alt: m.alt_text ?? '',
      })
      reviewPhotoMap.set(m.entity_id, list)
    }
  }
  const reviewCriteriaAverages: ReviewCriterionAverage[] = Array.from(criteriaAgg.values())
    .sort((a, b) => a.order - b.order)
    .map((a) => ({ name: a.name, average: Math.round((a.sum / a.count) * 10) / 10, count: a.count }))

  const reviewCriteria: ReviewCriterion[] = (
    (criteriaData as { id: string; name: string }[] | null) ?? []
  ).map((c) => ({ id: c.id, name: c.name }))

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const images: GalleryImage[] = (mediaData ?? []).map((m) => ({
    id: m.id,
    src: `${supabaseUrl}/storage/v1/object/public/listing-media/${m.file_path}`,
    alt: m.alt_text ?? '',
  }))

  const reviews: ReviewItem[] = (reviewsData ?? []).map((r) => ({
    id: r.id,
    rating: r.rating,
    title: r.title ?? null,
    body: r.body ?? null,
    published_at: r.published_at ?? null,
    is_verified_purchase: r.is_verified_purchase,
    reviewer_display_name: r.reviewer_user_id
      ? (reviewerNameMap[r.reviewer_user_id] ?? null)
      : null,
    owner_response: r.owner_response ?? null,
    owner_responded_at: r.owner_responded_at ?? null,
    criteria: (reviewCriteriaMap.get(r.id) ?? [])
      .sort((a, b) => a.order - b.order)
      .map(({ name, rating }) => ({ name, rating })),
    photos: reviewPhotoMap.get(r.id) ?? [],
  }))

  const serviceGroupMap = new Map<string, string | null>()
  for (const row of (serviceGroupData as { id: string; group_label: string | null }[] | null) ?? []) {
    serviceGroupMap.set(row.id, row.group_label ?? null)
  }

  type LinkRow = { id: string; link_type: string; url: string; label: string | null }
  const links: EntityLink[] = ((linksData as LinkRow[] | null) ?? [])
    .filter((l) => typeof l.url === 'string' && /^https:\/\//i.test(l.url))
    .map((l) => ({ id: l.id, type: l.link_type, url: l.url, label: l.label ?? null }))

  type FaqRow = { id: string; question: string; answer: string }
  const faqs: EntityFaq[] = ((faqData as FaqRow[] | null) ?? [])
    .filter((f) => f.question && f.answer)
    .map((f) => ({ id: f.id, question: f.question, answer: f.answer }))

  const det = raw.listing_details_business
  const cityData = raw.cities

  const details: BusinessDetails = {
    description: det?.description ?? '',
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
    cta_type: (det?.cta_type ?? 'learn-more') as CTAType,
    cta_url: det?.cta_url ?? null,
    cta_label_override: det?.cta_label_override ?? null,
    ships_nationwide: det?.ships_nationwide ?? raw.ships_nationwide,
    video_embed_url: (videoData as { video_embed_url: string | null } | null)?.video_embed_url ?? null,
    hours: (det?.hours as WeeklyHours | null) ?? null,
    services: (servicesData ?? []).map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description ?? '',
      price: s.price_display,
      group: serviceGroupMap.get(s.id) ?? null,
    })),
  }

  // Event detail — fetched only for event listings (fail-soft: a not-yet-migrated
  // listing_details_event table simply yields a null event and the page degrades).
  let event: EventDetails | null = null
  if (raw.entity_type === 'event') {
    const { data: ev } = await sb
      .from('listing_details_event')
      .select(
        'description, starts_at, ends_at, timezone, is_online, venue_name, venue_address, city_text, state, ticket_url, price_text, cta_type, cta_url, organizer_listing_id'
      )
      .eq('listing_id', raw.id)
      .maybeSingle()
    if (ev) {
      const e = ev as {
        description: string | null
        starts_at: string
        ends_at: string | null
        timezone: string | null
        is_online: boolean
        venue_name: string | null
        venue_address: string | null
        city_text: string | null
        state: string | null
        ticket_url: string | null
        price_text: string | null
        cta_type: string
        cta_url: string | null
        organizer_listing_id: string | null
      }
      let organizer: { name: string; url: string } | null = null
      if (e.organizer_listing_id) {
        const { data: org } = await supabase
          .from('listings')
          .select('name, slug, entity_type, cities(slug)')
          .eq('id', e.organizer_listing_id)
          .eq('status', 'published')
          .is('deleted_at', null)
          .maybeSingle()
        if (org) {
          organizer = {
            name: org.name,
            url: buildEntityUrl(
              org.entity_type,
              (org.cities as { slug: string } | null)?.slug,
              org.slug
            ),
          }
        }
      }
      event = {
        description: e.description ?? '',
        starts_at: e.starts_at,
        ends_at: e.ends_at,
        timezone: e.timezone,
        is_online: e.is_online,
        venue_name: e.venue_name,
        venue_address: e.venue_address,
        city_name: e.city_text ?? cityData?.name ?? null,
        state_abbr: e.state ?? cityData?.states?.code ?? null,
        ticket_url: e.ticket_url,
        price_text: e.price_text,
        cta_type: e.cta_type,
        cta_url: e.cta_url,
        organizer,
      }
    }
  }

  // Job detail — fetched only for job listings. Same fail-soft contract as the event
  // block above: an unmigrated listing_details_job yields a null job and the page degrades
  // rather than throwing.
  let job: JobDetails | null = null
  if (raw.entity_type === 'job') {
    const { data: jb } = await sb
      .from('listing_details_job')
      .select(
        'description, employment_type, workplace_type, salary_min, salary_max, salary_period, salary_currency, apply_url, apply_email, posted_at, closes_at, cta_type, cta_url, hiring_listing_id'
      )
      .eq('listing_id', raw.id)
      .maybeSingle()
    if (jb) {
      const j = jb as {
        description: string | null
        employment_type: string
        workplace_type: string
        salary_min: number | string | null
        salary_max: number | string | null
        salary_period: string | null
        salary_currency: string
        apply_url: string | null
        apply_email: string | null
        posted_at: string
        closes_at: string | null
        cta_type: string
        cta_url: string | null
        hiring_listing_id: string | null
      }
      let hiring: { name: string; url: string } | null = null
      if (j.hiring_listing_id) {
        const { data: co } = await supabase
          .from('listings')
          .select('name, slug, entity_type, cities(slug)')
          .eq('id', j.hiring_listing_id)
          .eq('status', 'published')
          .is('deleted_at', null)
          .maybeSingle()
        if (co) {
          hiring = {
            name: co.name,
            url: buildEntityUrl(
              co.entity_type,
              (co.cities as { slug: string } | null)?.slug,
              co.slug
            ),
          }
        }
      }
      // Postgres `numeric` arrives as a string over PostgREST — coerce here so the
      // renderer and the JSON-LD builder both get real numbers.
      const num = (v: number | string | null): number | null =>
        v === null || v === '' ? null : Number(v)
      job = {
        description: j.description ?? '',
        employment_type: j.employment_type,
        workplace_type: j.workplace_type,
        salary_min: num(j.salary_min),
        salary_max: num(j.salary_max),
        salary_period: j.salary_period,
        salary_currency: j.salary_currency,
        apply_url: j.apply_url,
        apply_email: j.apply_email,
        posted_at: j.posted_at,
        closes_at: j.closes_at,
        cta_type: j.cta_type,
        cta_url: j.cta_url,
        hiring,
      }
    }
  }

  // Upcoming events this listing organizes — surfaced on business pages. Fail-soft:
  // if listing_details_event isn't migrated yet this stays empty.
  let organizerEvents: OrganizerEvent[] = []
  if (raw.entity_type !== 'event') {
    const nowIso = new Date().toISOString()
    const { data: evRows } = await sb
      .from('listing_details_event')
      .select('listing_id, starts_at, is_online, venue_name, city_text')
      .eq('organizer_listing_id', raw.id)
      .gte('starts_at', nowIso)
      .order('starts_at', { ascending: true })
      .limit(8)
    const evList =
      (evRows as {
        listing_id: string
        starts_at: string
        is_online: boolean
        venue_name: string | null
        city_text: string | null
      }[] | null) ?? []
    if (evList.length > 0) {
      const { data: evListings } = await supabase
        .from('listings')
        .select('id, name, slug, entity_type, cities(slug)')
        .in(
          'id',
          evList.map((e) => e.listing_id)
        )
        .eq('status', 'published')
        .is('deleted_at', null)
      const listingMap = new Map(
        (evListings ?? []).map((l) => [
          l.id,
          {
            name: l.name,
            url: buildEntityUrl(l.entity_type, (l.cities as { slug: string } | null)?.slug, l.slug),
          },
        ])
      )
      organizerEvents = evList
        .filter((e) => listingMap.has(e.listing_id))
        .map((e) => {
          const l = listingMap.get(e.listing_id)!
          return {
            id: e.listing_id,
            name: l.name,
            url: l.url,
            starts_at: e.starts_at,
            is_online: e.is_online,
            venue_name: e.venue_name,
            city_name: e.city_text,
          }
        })
        .slice(0, 5)
    }
  }

  // Related cards — attach event start dates fail-soft so related event cards show a date.
  const related = (relatedData ?? []).map((r) => toDiscoveryEntity(r as unknown as RawRow))
  const relatedEventIds = related.filter((e) => e.entity_type === 'event').map((e) => e.id)
  if (relatedEventIds.length > 0) {
    const { data: relEvRows } = await sb
      .from('listing_details_event')
      .select('listing_id, starts_at')
      .in('listing_id', relatedEventIds)
    const relStartMap = new Map<string, string>()
    for (const row of (relEvRows as { listing_id: string; starts_at: string }[] | null) ?? []) {
      relStartMap.set(row.listing_id, row.starts_at)
    }
    for (const e of related) {
      if (e.entity_type === 'event') e.event_starts_at = relStartMap.get(e.id) ?? null
    }
  }

  return {
    id: raw.id,
    slug: raw.slug,
    name: raw.name,
    tagline: raw.tagline ?? '',
    entity_type: raw.entity_type as EntityPageData['entity_type'],
    location_type: raw.location_type as EntityPageData['location_type'],
    trust_tier: raw.trust_tier as EntityPageData['trust_tier'],
    tier: raw.tier as EntityPageData['tier'],
    ownership_label: raw.ownership_label as EntityPageData['ownership_label'],
    is_featured: raw.is_featured,
    is_sponsored: raw.is_sponsored,
    logo_path: raw.logo_path,
    cover_image_path: raw.cover_image_path,
    avg_rating: raw.avg_rating,
    review_count: raw.review_count,
    save_count: raw.save_count,
    owner_user_id: raw.owner_user_id,
    category: raw.categories ?? { name: 'General', slug: 'general' },
    city: cityData
      ? { name: cityData.name, slug: cityData.slug, state_abbr: cityData.states?.code ?? '' }
      : null,
    details,
    event,
    job,
    organizerEvents,
    attributes,
    links,
    faqs,
    related,
    images,
    reviews,
    reviewCriteria,
    reviewCriteriaAverages,
  }
}
