import { z } from 'zod'
import type { LocationType } from '@/types'

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

export const searchSchema = z.object({
  q: z.string().max(200).trim().optional(),
  city: z.string().optional(),
  category: z.string().optional(),
  type: z.enum(['business', 'professional', 'creative', 'event', 'job', 'vendor']).optional(),
  trust_tier: z.enum(['claimed', 'verified', 'certified']).optional(),
  location_type: z
    .enum(['physical', 'online', 'hybrid', 'virtual-services', 'ships-nationwide'] satisfies [
      LocationType,
      ...LocationType[],
    ])
    .optional(),
  // Faceted filters (CSV in the URL): price=$,$$  attrs=delivery,vegan-options
  price: csvArray,
  attrs: csvArray,
  open_now: z
    .union([z.literal('1'), z.literal('true'), z.literal('0'), z.literal('false')])
    .transform((v) => v === '1' || v === 'true')
    .optional(),
  sort: z.enum(['relevance', 'rating', 'reviews', 'newest', 'name', 'saves']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

export type SearchQueryParams = z.infer<typeof searchSchema>
