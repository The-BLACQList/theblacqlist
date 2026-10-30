import { buildEntityUrl } from '@/lib/listings/url'
import { resolveMediaPath } from '@/lib/listings/coverImage'
import type { DiscoveryEntity, JobCardData, JobCardDetails } from '@/types'

// Card data for a job (ticket 149). Pure helpers live here so they are unit
// testable; the two fail-soft queries live in lib/listings/query.ts.

interface JobRowLike {
  listing_id: string
  employment_type: string | null
  workplace_type: string | null
  salary_min: number | string | null
  salary_max: number | string | null
  salary_period: string | null
  closes_at: string | null
  hiring_listing_id: string | null
}

interface HiringRowLike {
  id: string
  name: string
  logo_path: string | null
}

/** "Austin, TX", "Remote", or null. Remote wins over the city. */
export function buildJobPlace(
  city: { name: string; state_abbr?: string | null } | null | undefined,
  workplaceType: string | null | undefined
): string | null {
  if (workplaceType === 'remote') return 'Remote'
  if (!city?.name) return null
  return city.state_abbr ? `${city.name}, ${city.state_abbr}` : city.name
}

// Postgres numeric arrives as a string over PostgREST.
function num(v: number | string | null): number | null {
  return v === null || v === '' ? null : Number(v)
}

/**
 * Join the job rows and their hiring listings into per-job card details.
 * A hiring business that is not in `hiring` (unpublished, hidden by RLS) leaves
 * the name and logo null, so the card falls back to the place.
 */
export function buildJobCardDetails(
  jobs: JobRowLike[],
  hiring: HiringRowLike[]
): Map<string, JobCardDetails> {
  const byHiring = new Map(hiring.map((h) => [h.id, h]))
  const out = new Map<string, JobCardDetails>()
  for (const j of jobs) {
    const h = j.hiring_listing_id ? byHiring.get(j.hiring_listing_id) : undefined
    out.set(j.listing_id, {
      businessName: h?.name ?? null,
      businessLogoUrl: resolveMediaPath(h?.logo_path),
      employmentType: j.employment_type,
      workplaceType: j.workplace_type,
      salaryMin: num(j.salary_min),
      salaryMax: num(j.salary_max),
      salaryPeriod: j.salary_period,
      closesAt: j.closes_at,
    })
  }
  return out
}

/** The JobCard props for a discovery entity. Works with or without attached details. */
export function toJobCardData(entity: DiscoveryEntity): JobCardData {
  const d = entity.job_details
  return {
    id: entity.id,
    href: buildEntityUrl(entity.entity_type, entity.city?.slug, entity.slug),
    title: entity.name,
    businessName: d?.businessName ?? null,
    businessLogoUrl: d?.businessLogoUrl ?? null,
    place: buildJobPlace(entity.city, d?.workplaceType),
    employmentType: d?.employmentType ?? null,
    workplaceType: d?.workplaceType ?? null,
    salaryMin: d?.salaryMin ?? null,
    salaryMax: d?.salaryMax ?? null,
    salaryPeriod: d?.salaryPeriod ?? null,
    closesAt: d?.closesAt ?? null,
  }
}
