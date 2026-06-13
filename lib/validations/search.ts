import { z } from 'zod'
import type { LocationType } from '@/types'

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
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

export type SearchQueryParams = z.infer<typeof searchSchema>
