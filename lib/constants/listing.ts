// Canonical value sets — these MUST match the LIVE DB CHECK constraints, which
// are set by migration `20260524000001_fix_entity_location_cta_constraints`
// (+ `20260622000007` re-adding 'event' to entity_type). NOTE: these differ from
// the original `20260510000000` schema — that earlier constraint was superseded.
// Do not "reconcile" against the initial schema; 20260524000001 is the truth.
export const VALID_ENTITY_TYPES = [
  'business',
  'restaurant',
  'service_provider',
  'creative',
  'professional',
  'vendor',
  'event',
] as const

export const VALID_LOCATION_TYPES = [
  'physical',
  'virtual',
  'hybrid',
  'service_area',
  'national',
  'traveling',
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
  'commission',
  'inquire',
  'get-tickets',
  'rsvp',
  'register',
  'learn-more',
  'apply',
  'buy-now',
] as const
