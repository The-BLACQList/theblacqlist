import { z } from 'zod'
import { VALID_ENTITY_TYPES, VALID_LOCATION_TYPES } from '@/lib/constants/listing'

/** Splits a comma-separated query param into a trimmed, de-duplicated array. */
const csvArray = z
  .string()
  .transform((s) =>
    Array.from(
      new Set(
        s
          .split(',')
          .map((v) => v.trim())
          .filter(Boolean)
      )
    )
  )
  .optional()

/**
 * A numeric URL param that treats an empty value (`?lat=`) as absent.
 *
 * `z.coerce.number()` turns `''` into `0`, and lat=0/lng=0 is a real point in
 * the Gulf of Guinea — so without this, `?radius=5&lat=&lng=` would have passed
 * the coordinate check below and searched Null Island, returning an
 * honest-looking zero results instead of the 400 the caller earned.
 */
const numericParam = (min: number, max: number) =>
  z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    z.coerce.number().min(min).max(max).optional()
  )

export const searchSchema = z.object({
  q: z.string().max(200).trim().optional(),
  city: z.string().optional(),
  category: z.string().optional(),
  // Both enums read the canonical constants directly rather than repeating the values.
  // A value the DB serves but zod rejects is a silent 400 on a legitimate URL — which is
  // exactly how 'service_provider' was broken from May until 2026-08-13, and how every
  // location_type except 'physical' and 'hybrid' was broken from May until 2026-08-15.
  // A retyped list is what made both possible, so there is no retyped list here.
  type: z.enum(VALID_ENTITY_TYPES).optional(),
  trust_tier: z.enum(['claimed', 'verified', 'certified']).optional(),
  location_type: z.enum(VALID_LOCATION_TYPES).optional(),
  // Faceted filters (CSV in the URL): price=$,$$  attrs=delivery,vegan-options
  price: csvArray,
  attrs: csvArray,
  open_now: z
    .union([z.literal('1'), z.literal('true'), z.literal('0'), z.literal('false')])
    .transform((v) => v === '1' || v === 'true')
    .optional(),
  // "Near You" (C3.2). All three are optional and all three must travel
  // together — see the superRefine below. 500 miles is the upper bound because
  // the RPC's bounding-box prefilter divides by 69.0 mi/degree; past a few
  // hundred miles the box stops narrowing anything and the filter is just a
  // slower way to say "everywhere".
  lat: numericParam(-90, 90),
  lng: numericParam(-180, 180),
  radius: numericParam(0.1, 500),
  sort: z.enum(['relevance', 'rating', 'reviews', 'newest', 'name', 'saves', 'distance']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})
  .superRefine((v, ctx) => {
    // The whole point of these three rules is that a location filter the server
    // cannot honor must FAIL, not quietly disappear. search_listings_faceted
    // short-circuits its radius predicate to TRUE when p_radius_miles is NULL,
    // and NULLS-LAST sorting makes `sort=distance` with no coordinates fall
    // through to the next key — so every one of these would otherwise return
    // 200 with the unfiltered index, which reads to a caller as "these are the
    // listings near you." Same rule 1.17 enforces for unresolvable slugs.
    const hasLat = v.lat !== undefined
    const hasLng = v.lng !== undefined

    if (hasLat !== hasLng) {
      ctx.addIssue({
        code: 'custom',
        path: [hasLat ? 'lng' : 'lat'],
        message: 'lat and lng must be provided together.',
      })
    }

    if (v.radius !== undefined && !(hasLat && hasLng)) {
      ctx.addIssue({
        code: 'custom',
        path: ['radius'],
        message: 'radius requires both lat and lng.',
      })
    }

    if (v.sort === 'distance' && !(hasLat && hasLng)) {
      ctx.addIssue({
        code: 'custom',
        path: ['sort'],
        message: 'sort=distance requires both lat and lng.',
      })
    }
  })

export type SearchQueryParams = z.infer<typeof searchSchema>
