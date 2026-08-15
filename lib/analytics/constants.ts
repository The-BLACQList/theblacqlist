// Analytics event names — the canonical set for this codebase.
// Extend here first; never hard-code strings in components or route handlers.

export const ANALYTICS_EVENTS = {
  // ── Discovery ────────────────────────────────────────────────────────────
  PAGE_VIEW: 'page_view',
  SEARCH_PERFORMED: 'search_performed',
  FILTER_APPLIED: 'filter_applied',
  COLLECTION_VIEWED: 'collection_viewed',
  GUIDE_VIEWED: 'guide_viewed',

  // ── Engagement ────────────────────────────────────────────────────────────
  CTA_CLICK: 'cta_click',
  HERO_CTA_CLICK: 'hero_cta_click',
  ACTION_BAR_CTA_CLICK: 'action_bar_cta_click',
  SAVE_TOGGLED: 'save_toggled',
  SHARE_INITIATED: 'share_initiated',

  // ── Marketplace ───────────────────────────────────────────────────────────
  MARKETPLACE_PRODUCT_VIEWED: 'marketplace_product_viewed',
  MARKETPLACE_CTA_CLICK: 'marketplace_cta_click',

  // ── Sponsored delivery ────────────────────────────────────────────────────
  // entity_type is 'sponsored_placement' and entity_id is the PLACEMENT id
  // (not the listing id) — a sponsor buys a placement, and the same listing can
  // hold several over time. See the reporting note below before reading these
  // numbers back to anyone who paid for them.
  SPONSORED_IMPRESSION: 'sponsored_impression',
  SPONSORED_CLICK: 'sponsored_click',

  // ── Conversion ────────────────────────────────────────────────────────────
  REVIEW_SUBMITTED: 'review_submitted',
  CLAIM_STARTED: 'claim_started',
  CLAIM_SUBMITTED: 'claim_submitted',
  LISTING_SUBMITTED: 'listing_submitted',
  RECEIPT_SUBMITTED: 'receipt_submitted',
} as const

/**
 * Event names written straight to `analytics_events` by trusted server actions,
 * which bypass the HTTP route and therefore bypass VALID_EVENT_NAMES entirely.
 * They are declared here so this file describes what is actually in the table,
 * but deliberately kept OUT of VALID_EVENT_NAMES — the public endpoint should
 * not let a browser forge a draft-created or product-created event.
 *
 * Emitters: createListing.ts:314, createProduct.ts:164, createService.ts:144.
 */
export const SERVER_ONLY_EVENTS = {
  LISTING_DRAFT_CREATED: 'listing_draft_created',
  PRODUCT_CREATED: 'product_created',
  SERVICE_CREATED: 'service_created',
} as const

export type AnalyticsEventName = (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS]
export type ServerOnlyEventName = (typeof SERVER_ONLY_EVENTS)[keyof typeof SERVER_ONLY_EVENTS]

// Used by the route handler to validate incoming event_name values.
// Intentionally excludes SERVER_ONLY_EVENTS — see the note above.
export const VALID_EVENT_NAMES: ReadonlySet<string> = new Set<string>(
  Object.values(ANALYTICS_EVENTS)
)

/**
 * Emission status as of 2026-08-11. Kept honest because the owner-facing
 * dashboard is a paid feature — a declared-but-unemitted name renders as a
 * confident zero, which is worse than an absent metric.
 *
 *   Emitted: page_view, search_performed, cta_click, save_toggled,
 *            share_initiated, claim_submitted, listing_submitted
 *            + the three SERVER_ONLY_EVENTS above.
 *
 *   share_initiated is emitted by components/entity-page/ShareButton.tsx, which
 *   until 2026-08-11 was defined but mounted nowhere — all three share
 *   affordances (hero + both quick-action bars) were placeholder buttons with
 *   no onClick. Wiring them is what made this line true.
 *
 *   Declared, nothing emits them yet: filter_applied, collection_viewed,
 *            guide_viewed, hero_cta_click, action_bar_cta_click,
 *            marketplace_product_viewed, marketplace_cta_click,
 *            review_submitted, claim_started, receipt_submitted.
 *
 *   Added 2026-08-15 and emitted from the same commit: sponsored_impression,
 *   sponsored_click (components/entities/SponsoredTracking.tsx).
 *
 * Wire an emitter before surfacing any of the second group in a UI.
 */

/**
 * WHAT THE SPONSORED NUMBERS MEAN — read before quoting them to a sponsor.
 *
 * 1. Both are CLIENT-REPORTED, same trust level as page_view and cta_click.
 *    They travel through /api/analytics/event, which any browser can POST to.
 *    They are rate-limited (30/IP/min) but not authenticated, so treat them as
 *    delivery telemetry, not as a billing meter.
 *
 * 2. Impression = "the card was rendered in the results", counted once per card
 *    mount. It is NOT viewport-verified — a card below the fold still counts.
 *
 * 3. Client-side is the only correct place to count these. The sponsored splice
 *    lives in lib/listings/query.ts, which runs inside an ISR page
 *    (app/[citySlug]/[entityType]/page.tsx, revalidate = 86400). A server-side
 *    count there would record one impression per REVALIDATION rather than per
 *    view, under-reporting by orders of magnitude, and `after()` is not even
 *    available during generateStaticParams prerender.
 */

// ── Properties ───────────────────────────────────────────────────────────────
// Allowed metadata per event. All shapes are optional at the transport layer;
// these types document intent for callers.
// PRIVACY RULE: no email, name, phone, full URL, or personally identifying data.

export interface SearchPerformedProperties {
  query?: string // raw query text (no PII expected; reviewed periodically)
  result_count?: number
  city_id?: string
  category_id?: string
}

export interface FilterAppliedProperties {
  filter_type: string // 'city' | 'category' | 'trust_tier' | 'location_type'
  filter_value?: string
}

export interface PageViewProperties {
  entity_type?: string
  referrer_type?: string // 'search' | 'collection' | 'direct' | 'share'
}

export interface CtaClickProperties {
  cta_type?: string
  listing_id?: string
  destination_domain?: string // domain only, never the full URL
}

export interface SaveToggledProperties {
  // Must stay 'save' | 'unsave' — the nightly rollup filters on
  // (properties->>'action') = 'save' (20260515000000_analytics_aggregation.sql).
  // These were 'saved'/'unsaved' until 2026-08-11, which meant any correct
  // emitter would still have rolled up zero saves.
  action?: 'save' | 'unsave'
  source?: string // 'entity_page' | 'search_result' | 'collection'
}

export interface ShareInitiatedProperties {
  method?: string // 'copy_link' | 'native_share'
  source?: string
}

export interface ReviewSubmittedProperties {
  rating?: number // 1–5 only; no review text, no author name
}

export interface ListingSubmittedProperties {
  entity_type?: string
  category_id?: string
  city_id?: string
}

export interface ReceiptSubmittedProperties {
  listing_id?: string
  // amount intentionally excluded to avoid exposing spend data in event stream
}

export interface MarketplaceProductViewedProperties {
  listing_id?: string
}

export interface MarketplaceCtaClickProperties {
  cta_type?: string // 'shop-now' | 'book-now' | 'visit-website'
  listing_id?: string
}

export interface SponsoredDeliveryProperties {
  listing_id?: string
  position?: number // 1–3, the slot the placement was served into
  surface?: string // 'discover' | 'city_category' | 'search'
}

export interface GuidViewedProperties {
  guide_slug?: string
}

export interface CollectionViewedProperties {
  collection_slug?: string
}

// Convenience union for callers that accept any allowed properties object.
export type AnyEventProperties =
  | SearchPerformedProperties
  | FilterAppliedProperties
  | PageViewProperties
  | CtaClickProperties
  | SaveToggledProperties
  | ShareInitiatedProperties
  | ReviewSubmittedProperties
  | ListingSubmittedProperties
  | ReceiptSubmittedProperties
  | MarketplaceProductViewedProperties
  | MarketplaceCtaClickProperties
  | SponsoredDeliveryProperties
  | GuidViewedProperties
  | CollectionViewedProperties
  | Record<string, string | number | boolean | null | undefined>
