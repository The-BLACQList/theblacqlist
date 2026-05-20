// Analytics event names — the canonical set for this codebase.
// Extend here first; never hard-code strings in components or route handlers.

export const ANALYTICS_EVENTS = {
  // ── Discovery ────────────────────────────────────────────────────────────
  PAGE_VIEW:                  "page_view",
  SEARCH_PERFORMED:           "search_performed",
  FILTER_APPLIED:             "filter_applied",
  COLLECTION_VIEWED:          "collection_viewed",
  GUIDE_VIEWED:               "guide_viewed",

  // ── Engagement ────────────────────────────────────────────────────────────
  CTA_CLICK:                  "cta_click",
  HERO_CTA_CLICK:             "hero_cta_click",
  ACTION_BAR_CTA_CLICK:       "action_bar_cta_click",
  SAVE_TOGGLED:               "save_toggled",
  SHARE_INITIATED:            "share_initiated",

  // ── Marketplace ───────────────────────────────────────────────────────────
  MARKETPLACE_PRODUCT_VIEWED: "marketplace_product_viewed",
  MARKETPLACE_CTA_CLICK:      "marketplace_cta_click",

  // ── Conversion ────────────────────────────────────────────────────────────
  REVIEW_SUBMITTED:           "review_submitted",
  CLAIM_STARTED:              "claim_started",
  CLAIM_SUBMITTED:            "claim_submitted",
  LISTING_SUBMITTED:          "listing_submitted",
  RECEIPT_SUBMITTED:          "receipt_submitted",
} as const

export type AnalyticsEventName = (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS]

// Used by the route handler to validate incoming event_name values.
export const VALID_EVENT_NAMES: ReadonlySet<string> = new Set<string>(
  Object.values(ANALYTICS_EVENTS)
)

// ── Properties ───────────────────────────────────────────────────────────────
// Allowed metadata per event. All shapes are optional at the transport layer;
// these types document intent for callers.
// PRIVACY RULE: no email, name, phone, full URL, or personally identifying data.

export interface SearchPerformedProperties {
  query?: string          // raw query text (no PII expected; reviewed periodically)
  result_count?: number
  city_id?: string
  category_id?: string
}

export interface FilterAppliedProperties {
  filter_type: string     // 'city' | 'category' | 'trust_tier' | 'location_type'
  filter_value?: string
}

export interface PageViewProperties {
  entity_type?: string
  referrer_type?: string  // 'search' | 'collection' | 'direct' | 'share'
}

export interface CtaClickProperties {
  cta_type?: string
  listing_id?: string
  destination_domain?: string  // domain only, never the full URL
}

export interface SaveToggledProperties {
  action?: "saved" | "unsaved"
  source?: string  // 'entity_page' | 'search_result' | 'collection'
}

export interface ShareInitiatedProperties {
  method?: string  // 'copy_link' | 'native_share'
  source?: string
}

export interface ReviewSubmittedProperties {
  rating?: number  // 1–5 only; no review text, no author name
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
  cta_type?: string     // 'shop-now' | 'book-now' | 'visit-website'
  listing_id?: string
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
  | GuidViewedProperties
  | CollectionViewedProperties
  | Record<string, string | number | boolean | null | undefined>
