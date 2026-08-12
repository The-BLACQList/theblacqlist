// ─── Discovery / Listing Types ───────────────────────────────────────────────

/**
 * The live `listings.entity_type` CHECK — see lib/constants/listing.ts:VALID_ENTITY_TYPES,
 * which this must mirror exactly. Until 2026-08-13 this union carried 'job' (which the DB
 * rejected) and omitted 'restaurant' / 'service_provider' (which the DB served); the drift
 * forced an `as string` cast in the entity-page renderer. Both ends now agree.
 */
export type EntityType =
  | 'business'
  | 'restaurant'
  | 'service_provider'
  | 'professional'
  | 'creative'
  | 'vendor'
  | 'event'
  | 'job'

export type LocationType =
  | 'physical'
  | 'online'
  | 'hybrid'
  | 'virtual-services'
  | 'ships-nationwide'

export type TrustTier = 'unclaimed' | 'claimed' | 'verified' | 'certified'

export type Tier = 'free' | 'standard' | 'premium'

/** Authoritative ownership label. See lib/constants/listing.ts. */
export type OwnershipLabel = 'black_owned' | 'ally'

export interface DiscoveryEntity {
  id: string
  name: string
  slug: string
  entity_type: EntityType
  tagline: string
  description: string
  category: { name: string; slug: string }
  city: { name: string; slug: string; state_abbr: string } | null
  location_type: LocationType
  trust_tier: TrustTier
  tier: Tier
  ownership_label: OwnershipLabel
  is_featured: boolean
  is_sponsored: boolean
  logo_path: string | null
  cover_image_path: string | null
  avg_rating: number | null
  review_count: number
  save_count: number
  /** Up to two Identity & Ownership attribute names shown as card chips. */
  identity_chips?: string[]
  /** Event start (ISO) — attached fail-soft for entity_type='event' so cards can show a date. */
  event_starts_at?: string | null
  /** Per-user save state — attached fail-soft in queryListings (anon → false). */
  isSaved?: boolean
}

// ─── CTA Types ────────────────────────────────────────────────────────────────

export type CTAType =
  | 'book'
  | 'order'
  | 'call'
  | 'message'
  | 'visit'
  | 'get-quote'
  | 'shop'
  | 'subscribe'
  | 'contact'
  | 'commission'
  | 'inquire'
  | 'get-tickets'
  | 'rsvp'
  | 'register'
  | 'learn-more'
  | 'apply'
  | 'buy-now'

export const CTA_LABELS: Record<CTAType, string> = {
  book: 'Book Now',
  order: 'Order Now',
  call: 'Call Now',
  message: 'Send Message',
  visit: 'Visit Us',
  'get-quote': 'Get a Quote',
  shop: 'Shop Now',
  subscribe: 'Subscribe',
  contact: 'Contact Us',
  commission: 'Commission Work',
  inquire: 'Inquire',
  'get-tickets': 'Get Tickets',
  rsvp: 'RSVP',
  register: 'Register',
  'learn-more': 'Learn More',
  apply: 'Apply Now',
  'buy-now': 'Buy Now',
}

export function getCtaLabel(ctaType: CTAType, override: string | null): string {
  return override?.trim() || CTA_LABELS[ctaType] || 'Learn More'
}

// ─── Entity Page Types ────────────────────────────────────────────────────────

export interface DayHours {
  open: string // "HH:MM" 24-hour
  close: string // "HH:MM" 24-hour
  closed: boolean
}

export interface WeeklyHours {
  monday: DayHours
  tuesday: DayHours
  wednesday: DayHours
  thursday: DayHours
  friday: DayHours
  saturday: DayHours
  sunday: DayHours
}

export interface ServiceItem {
  id: string
  name: string
  description: string
  price: string | null
  group: string | null
}

export interface SocialLinks {
  instagram: string | null
  facebook: string | null
  linkedin: string | null
  tiktok: string | null
  youtube: string | null
  twitter: string | null
}

export interface BusinessDetails {
  description: string
  hours: WeeklyHours | null
  address: string | null
  address_line2: string | null
  city_name: string | null
  state_abbr: string | null
  zip: string | null
  phone: string | null
  email: string | null
  website_url: string | null
  social: SocialLinks
  cta_type: CTAType
  cta_url: string | null
  cta_label_override: string | null
  ships_nationwide: boolean
  video_embed_url: string | null
  services: ServiceItem[]
}

export interface GalleryImage {
  id: string
  src: string
  alt: string
}

export interface ReviewCriterionScore {
  name: string
  rating: number
}

export interface ReviewItem {
  id: string
  rating: number
  title: string | null
  body: string | null
  published_at: string | null
  is_verified_purchase: boolean
  reviewer_display_name?: string | null
  owner_response: string | null
  owner_responded_at: string | null
  criteria: ReviewCriterionScore[]
  photos: GalleryImage[]
}

export interface ReviewCriterion {
  id: string
  name: string
}

export interface ReviewCriterionAverage {
  name: string
  average: number
  count: number
}

export interface EntityAttributeValue {
  name: string
  slug: string
  icon: string | null
}

export interface EntityAttributeGroup {
  group: string
  values: EntityAttributeValue[]
}

export interface EntityLink {
  id: string
  type: string
  url: string
  label: string | null
}

export interface EntityFaq {
  id: string
  question: string
  answer: string
}

export interface OrganizerEvent {
  id: string
  name: string
  url: string
  starts_at: string
  is_online: boolean
  venue_name: string | null
  city_name: string | null
}

export interface EventDetails {
  description: string
  starts_at: string
  ends_at: string | null
  timezone: string | null
  is_online: boolean
  venue_name: string | null
  venue_address: string | null
  city_name: string | null
  state_abbr: string | null
  ticket_url: string | null
  price_text: string | null
  cta_type: string
  cta_url: string | null
  organizer: { name: string; url: string } | null
}

export interface JobDetails {
  description: string
  employment_type: string
  workplace_type: string
  salary_min: number | null
  salary_max: number | null
  /** Required by a DB CHECK whenever either salary bound is set. */
  salary_period: string | null
  salary_currency: string
  apply_url: string | null
  apply_email: string | null
  posted_at: string
  closes_at: string | null
  cta_type: string
  cta_url: string | null
  /** The company doing the hiring, when the owner linked one of their listings. */
  hiring: { name: string; url: string } | null
}

export interface EntityPageData {
  id: string
  entity_type: EntityType
  name: string
  slug: string
  tagline: string
  category: { name: string; slug: string }
  city: { name: string; slug: string; state_abbr: string } | null
  location_type: LocationType
  trust_tier: TrustTier
  tier: Tier
  ownership_label: OwnershipLabel
  is_featured: boolean
  is_sponsored: boolean
  logo_path: string | null
  cover_image_path: string | null
  avg_rating: number | null
  review_count: number
  save_count: number
  owner_user_id: string | null
  details: BusinessDetails
  event: EventDetails | null
  job: JobDetails | null
  organizerEvents: OrganizerEvent[]
  attributes: EntityAttributeGroup[]
  links: EntityLink[]
  faqs: EntityFaq[]
  related: DiscoveryEntity[]
  images: GalleryImage[]
  reviews: ReviewItem[]
  reviewCriteria: ReviewCriterion[]
  reviewCriteriaAverages: ReviewCriterionAverage[]
}
