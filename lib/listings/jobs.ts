import { createClient } from '@/lib/supabase/server'
import { attachJobCardData } from '@/lib/listings/jobCardQuery'
import { mapRow, NESTED_SELECT, LISTINGS_PAGE_SIZE, type RawRow } from '@/lib/listings/query'
import type { JobFilters } from '@/lib/validations/jobs'
import type { DiscoveryEntity } from '@/types'

// The Jobs board reads (ticket 150). Two steps, both plain PostgREST:
//   1. listing_details_job gives the ids of OPEN roles that match the kind of
//      work and Remote filters (open = no deadline, or a deadline in the future).
//   2. listings gives the page of those ids (published, city filter, count).
// Unlike queryListings these THROW on a failed read, so the board can show its
// error state instead of "no open roles", which would be untrue.

/** The slice of the Supabase client these reads use; a loose chain keeps tests simple. */
interface Chain extends PromiseLike<{ data: unknown; error: unknown; count?: number | null }> {
  select: (columns: string, opts?: { count: 'exact' }) => Chain
  or: (filter: string) => Chain
  in: (column: string, values: string[]) => Chain
  eq: (column: string, value: unknown) => Chain
  is: (column: string, value: null) => Chain
  order: (column: string, opts: { ascending: boolean }) => Chain
  range: (from: number, to: number) => Chain
  limit: (n: number) => Chain
}
type LooseClient = { from: (table: string) => Chain }

export interface JobFilterOptions {
  /** True when any open role is remote. */
  hasRemote: boolean
  /** Cities with at least one open role, A to Z. */
  cities: Array<{ slug: string; label: string }>
}

interface OpenJobRow {
  listing_id: string
  workplace_type: string | null
}

interface CityRow {
  id: string
  city_id: string | null
  cities: { name: string; slug: string; states: { code: string } | null } | null
}

function fail(what: string, error: unknown): never {
  const msg = error instanceof Error ? error.message : JSON.stringify(error)
  throw new Error(`jobs board: ${what} failed: ${msg}`)
}

async function run(q: Chain, what: string): Promise<{ data: unknown; count: number | null }> {
  const res = await q
  if (res.error) fail(what, res.error)
  return { data: res.data, count: res.count ?? null }
}

/** Rows of open roles, optionally narrowed by kind of work and Remote. */
async function openJobRows(
  db: LooseClient,
  opts: { types?: string[]; remoteOnly?: boolean }
): Promise<OpenJobRow[]> {
  let q = db
    .from('listing_details_job')
    .select('listing_id, workplace_type')
    .or(`closes_at.is.null,closes_at.gt.${new Date().toISOString()}`)
  if (opts.types?.length) q = q.in('employment_type', opts.types)
  if (opts.remoteOnly) q = q.eq('workplace_type', 'remote')
  const { data } = await run(q, 'open roles')
  return (data as OpenJobRow[] | null) ?? []
}

/** Pure: shapes the Where chips from open roles and the cities they sit in. */
export function buildJobFilterOptions(jobs: OpenJobRow[], listings: CityRow[]): JobFilterOptions {
  const cities = new Map<string, string>()
  for (const l of listings) {
    if (!l.cities) continue
    const state = l.cities.states?.code
    cities.set(l.cities.slug, state ? `${l.cities.name}, ${state}` : l.cities.name)
  }
  return {
    hasRemote: jobs.some((j) => j.workplace_type === 'remote'),
    cities: [...cities]
      .map(([slug, label]) => ({ slug, label }))
      .sort((a, b) => a.label.localeCompare(b.label)),
  }
}

export async function getJobFilterOptions(client?: unknown): Promise<JobFilterOptions> {
  const db = (client ?? (await createClient())) as LooseClient
  const jobs = await openJobRows(db, {})
  if (jobs.length === 0) return { hasRemote: false, cities: [] }
  const { data } = await run(
    db
      .from('listings')
      .select(
        'id, city_id, cities!listings_city_id_fkey(name, slug, states!cities_state_id_fkey(code))'
      )
      .in(
        'id',
        jobs.map((j) => j.listing_id)
      )
      .eq('status', 'published')
      .is('deleted_at', null),
    'job cities'
  )
  const listings = (data as CityRow[] | null) ?? []
  const published = new Set(listings.map((l) => l.id))
  return buildJobFilterOptions(
    jobs.filter((j) => published.has(j.listing_id)),
    listings
  )
}

export interface JobsResult {
  entities: DiscoveryEntity[]
  total: number
}

export async function queryJobs(filters: JobFilters): Promise<JobsResult> {
  const supabase = await createClient()
  const db = supabase as unknown as LooseClient
  const remoteOnly = filters.where === 'remote'

  const rows = await openJobRows(db, { types: filters.types, remoteOnly })
  if (rows.length === 0) return { entities: [], total: 0 }

  let cityId: string | null = null
  if (filters.where && !remoteOnly) {
    const { data } = await run(
      db.from('cities').select('id').eq('slug', filters.where).limit(1),
      'city lookup'
    )
    cityId = (data as Array<{ id: string }> | null)?.[0]?.id ?? null
    // A slug that matches no city matches no role. Never widen to everything.
    if (!cityId) return { entities: [], total: 0 }
  }

  const offset = (filters.page - 1) * LISTINGS_PAGE_SIZE
  let q = db
    .from('listings')
    .select(NESTED_SELECT, { count: 'exact' })
    .in(
      'id',
      rows.map((r) => r.listing_id)
    )
    .eq('entity_type', 'job')
    .eq('status', 'published')
    .is('deleted_at', null)
    .eq('flag_status', 'none')
  if (cityId) q = q.eq('city_id', cityId)
  q = q
    .order('is_featured', { ascending: false })
    .order('created_at', { ascending: false })
    .range(offset, offset + LISTINGS_PAGE_SIZE - 1)

  const { data, count } = await run(q, 'jobs page')
  const entities = ((data as RawRow[] | null) ?? []).map(mapRow)
  await attachJobCardData(supabase, entities)
  return { entities, total: count ?? entities.length }
}
