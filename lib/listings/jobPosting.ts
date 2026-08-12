import { buildEntityUrl } from '@/lib/listings/url'
import { JOB_SALARY_PERIOD_META, type JobSalaryPeriod } from '@/lib/constants/listing'
import type { EntityPageData } from '@/types'

// Lives in lib/ rather than beside buildEventJsonLd in the page component so the
// mapping is unit-testable — a JobPosting that silently loses baseSalary or emits
// a jobLocation on a remote role costs the listing its Google Jobs eligibility,
// and nothing about that failure is visible in the rendered page.

/**
 * Renders a pay range for human display. Returns null when no salary was given —
 * callers should omit the row entirely rather than print "Salary: —".
 *
 * A DB CHECK guarantees `period` is set whenever either bound is, but this
 * degrades to an unsuffixed figure rather than dropping the pay if that ever
 * stops being true.
 */
export function formatSalary(
  min: number | null,
  max: number | null,
  period: string | null,
  currency: string
): string | null {
  if (min === null && max === null) return null

  const suffix = (JOB_SALARY_PERIOD_META[period as JobSalaryPeriod] ?? { suffix: '' }).suffix

  const money = (value: number): string => {
    const fractionDigits = Number.isInteger(value) ? 0 : 2
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
        minimumFractionDigits: fractionDigits,
        maximumFractionDigits: fractionDigits,
      }).format(value)
    } catch {
      // `salary_currency` is a free-text column; an unknown code makes Intl throw
      // rather than fall back, and a thrown formatter would take down the page.
      return `${currency} ${value.toLocaleString('en-US')}`
    }
  }

  if (min !== null && max !== null) {
    return min === max ? `${money(min)}${suffix}` : `${money(min)} – ${money(max)}${suffix}`
  }
  if (min !== null) return `From ${money(min)}${suffix}`
  return `Up to ${money(max as number)}${suffix}`
}

// schema.org employmentType vocabulary. Our column values are the human-facing
// slugs; these are the values Google expects.
const EMPLOYMENT_TYPE_SCHEMA: Record<string, string> = {
  'full-time': 'FULL_TIME',
  'part-time': 'PART_TIME',
  contract: 'CONTRACTOR',
  temporary: 'TEMPORARY',
  internship: 'INTERN',
  volunteer: 'VOLUNTEER',
}

const SALARY_UNIT_TEXT: Record<string, string> = {
  hour: 'HOUR',
  day: 'DAY',
  week: 'WEEK',
  month: 'MONTH',
  year: 'YEAR',
}

/**
 * schema.org JobPosting for a job listing. Every property is sourced from a real
 * column — anything the owner did not provide is omitted, never invented.
 */
export function buildJobPostingJsonLd(
  entity: EntityPageData | null,
  entityType: string
): Record<string, unknown> | null {
  if (!entity || !entity.job) return null
  const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://theblacqlist.com'
  const job = entity.job
  const isRemote = job.workplace_type === 'remote'

  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title: entity.name,
    description: job.description || entity.tagline,
    url: `${BASE_URL}${buildEntityUrl(entityType, entity.city?.slug, entity.slug)}`,
    datePosted: job.posted_at,
    ...(job.closes_at && { validThrough: job.closes_at }),
    ...(EMPLOYMENT_TYPE_SCHEMA[job.employment_type] && {
      employmentType: EMPLOYMENT_TYPE_SCHEMA[job.employment_type],
    }),
    hiringOrganization: {
      '@type': 'Organization',
      name: job.hiring?.name ?? entity.name,
      ...(job.hiring && { sameAs: `${BASE_URL}${job.hiring.url}` }),
    },
  }

  if (isRemote) {
    // Google requires BOTH of these on a remote role, and requires jobLocation to
    // be absent — a Place on a TELECOMMUTE posting is a validation error.
    jsonLd.jobLocationType = 'TELECOMMUTE'
    jsonLd.applicantLocationRequirements = { '@type': 'Country', name: 'USA' }
  } else if (entity.city) {
    jsonLd.jobLocation = {
      '@type': 'Place',
      address: {
        '@type': 'PostalAddress',
        addressLocality: entity.city.name,
        addressRegion: entity.city.state_abbr,
        addressCountry: 'US',
      },
    }
  }

  // baseSalary needs a unit; without a period there is no readable amount, so the
  // whole property is dropped rather than emitted half-formed.
  const unitText = job.salary_period ? SALARY_UNIT_TEXT[job.salary_period] : undefined
  if (unitText && (job.salary_min !== null || job.salary_max !== null)) {
    jsonLd.baseSalary = {
      '@type': 'MonetaryAmount',
      currency: job.salary_currency,
      value: {
        '@type': 'QuantitativeValue',
        ...(job.salary_min !== null && { minValue: job.salary_min }),
        ...(job.salary_max !== null && { maxValue: job.salary_max }),
        unitText,
      },
    }
  }

  return jsonLd
}
