import { buildJobCardDetails } from '@/lib/listings/jobCard'
import type { JobCardDetails } from '@/types'

// Job-card facts fetched separately from the listings select, the same fail-soft
// pattern as attachEventStartDates in query.ts: listing_details_job stays out of
// NESTED_SELECT, and a broken read leaves the card with its title and place
// instead of taking the board down. Two small queries, no join.

type Result = Promise<{ data: unknown; error: unknown }>

/** The slice of the Supabase client this needs, so tests can fake it. */
export interface JobCardClient {
  from: (table: string) => {
    select: (columns: string) => {
      in: (column: string, values: string[]) => JobFilter
    }
  }
}

interface JobFilter extends PromiseLike<{ data: unknown; error: unknown }> {
  eq?: (column: string, value: unknown) => JobFilter
  is?: (column: string, value: null) => JobFilter
}

interface JobCardRow {
  id: string
  entity_type: string
  job_details?: JobCardDetails | null
}

interface JobRow {
  listing_id: string
  employment_type: string | null
  workplace_type: string | null
  salary_min: number | string | null
  salary_max: number | string | null
  salary_period: string | null
  closes_at: string | null
  hiring_listing_id: string | null
}

/**
 * Sets `job_details` on every job row. Never throws: a failure on the job query
 * leaves the rows untouched, and a failure on the hiring-business query keeps
 * the pay and dates but drops the business line.
 */
export async function attachJobCardData<T extends JobCardRow>(
  supabase: unknown,
  rows: T[]
): Promise<void> {
  const ids = rows.filter((r) => r.entity_type === 'job').map((r) => r.id)
  if (ids.length === 0) return
  const client = supabase as JobCardClient

  try {
    const jobRes = await (client
      .from('listing_details_job')
      .select(
        'listing_id, employment_type, workplace_type, salary_min, salary_max, salary_period, closes_at, hiring_listing_id'
      )
      .in('listing_id', ids) as unknown as Result)
    if (jobRes.error || !Array.isArray(jobRes.data)) return
    const jobs = jobRes.data as JobRow[]

    const hiringIds = [
      ...new Set(jobs.map((j) => j.hiring_listing_id).filter((v): v is string => !!v)),
    ]
    let hiring: Array<{ id: string; name: string; logo_path: string | null }> = []
    if (hiringIds.length > 0) {
      try {
        // Published only: an unpublished business gives no name and the card
        // falls back to the place.
        let q = client.from('listings').select('id, name, logo_path').in('id', hiringIds)
        q = q.eq?.('status', 'published') ?? q
        q = q.is?.('deleted_at', null) ?? q
        const hiringRes = (await q) as { data: unknown; error: unknown }
        if (!hiringRes.error && Array.isArray(hiringRes.data)) {
          hiring = hiringRes.data as typeof hiring
        }
      } catch {
        // keep the pay and dates, drop the business line
      }
    }

    const details = buildJobCardDetails(jobs, hiring)
    for (const r of rows) {
      if (r.entity_type === 'job') r.job_details = details.get(r.id) ?? null
    }
  } catch {
    // fail soft: the card renders without chips
  }
}
