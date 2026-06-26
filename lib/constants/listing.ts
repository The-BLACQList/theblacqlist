// Canonical value sets — these MUST match the DB CHECK constraints on
// listings.entity_type / listings.location_type / listing_details_business.cta_type
// (migration 20260510000000). Keeping these in sync with the DB is what prevents
// the add-business form from submitting a value the database then rejects.
//
// The add-business form offers a curated SUBSET of entity types
// (Business / Professional / Creative). Events use the dedicated /add-event flow;
// Jobs and Vendor are valid in the DB but not offered in the business form yet.
export const VALID_ENTITY_TYPES = [
  'business',
  'professional',
  'creative',
  'event',
  'job',
  'vendor',
] as const

export const VALID_LOCATION_TYPES = [
  'physical',
  'online',
  'hybrid',
  'virtual-services',
  'ships-nationwide',
] as const

export const VALID_CTA_TYPES = [
  'book',
  'order',
  'call',
  'message',
  'visit',
  'get-quote',
  'shop',
  'subscribe',
  'contact',
] as const
