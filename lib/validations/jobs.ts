import { z } from 'zod'
import { JOB_EMPLOYMENT_TYPES, type JobEmploymentType } from '@/lib/constants/listing'

// URL filters for the Jobs board (ticket 150). Unknown values are dropped, never
// an error: a stale or hand-edited link still opens the board.

/** Kind of work chips, in the order they are shown. */
export const JOB_TYPE_CHIP_ORDER: readonly JobEmploymentType[] = [
  'full-time',
  'part-time',
  'contract',
  'internship',
  'volunteer',
  'temporary',
]

const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .max(80)

const rawParamSchema = z.union([z.string(), z.array(z.string())]).optional()

export interface JobFilters {
  /** `remote` or a city slug. */
  where: string | null
  types: JobEmploymentType[]
  page: number
  /** Only roles posted by this business (listing id). Omitted when not filtering by one. */
  business?: string
}

export type RawJobParams = Record<string, string | string[] | undefined>

function first(v: string | string[] | undefined): string | undefined {
  const parsed = rawParamSchema.safeParse(v)
  if (!parsed.success || parsed.data === undefined) return undefined
  return Array.isArray(parsed.data) ? parsed.data[0] : parsed.data
}

export function parseJobFilters(raw: RawJobParams): JobFilters {
  const whereRaw = first(raw.where)?.split(',')[0]
  const where = whereRaw !== undefined ? slugSchema.safeParse(whereRaw) : null

  const known = new Set<string>(JOB_EMPLOYMENT_TYPES)
  const wanted = new Set(
    (first(raw.type) ?? '')
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter((t) => known.has(t))
  )
  const types = JOB_TYPE_CHIP_ORDER.filter((t) => wanted.has(t))

  const page = Math.max(1, parseInt(first(raw.page) ?? '1', 10) || 1)
  const business = z.string().uuid().safeParse(first(raw.business))
  return {
    where: where?.success ? where.data : null,
    types,
    page,
    ...(business.success ? { business: business.data.toLowerCase() } : {}),
  }
}

type FilterShape = Pick<JobFilters, 'where' | 'types' | 'business'>

export function hasJobFilters(f: FilterShape): boolean {
  return f.where !== null || f.types.length > 0 || !!f.business
}

/**
 * The board URL for a set of filters. `page` is only written when asked for, so
 * changing a filter (which passes no page) always lands back on page 1.
 */
export function buildJobsUrl(f: FilterShape, page = 1): string {
  const parts: string[] = []
  if (f.where) parts.push(`where=${encodeURIComponent(f.where)}`)
  if (f.types.length > 0) parts.push(`type=${f.types.join(',')}`)
  if (f.business) parts.push(`business=${f.business}`)
  if (page > 1) parts.push(`page=${page}`)
  return parts.length > 0 ? `/jobs?${parts.join('&')}` : '/jobs'
}

export function toggleJobType(
  types: JobEmploymentType[],
  t: JobEmploymentType
): JobEmploymentType[] {
  const next = types.includes(t) ? types.filter((x) => x !== t) : [...types, t]
  return JOB_TYPE_CHIP_ORDER.filter((x) => next.includes(x))
}
