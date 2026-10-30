import { formatCloseDate, formatJobPay, isRoleClosed } from '@/lib/listings/jobPosting'
import { buildJobPlace } from '@/lib/listings/jobCard'
import {
  JOB_EMPLOYMENT_TYPE_META,
  JOB_WORKPLACE_TYPE_META,
  type JobEmploymentType,
  type JobWorkplaceType,
} from '@/lib/constants/listing'
import type { JobDetails } from '@/types'

export interface JobFact {
  label: string
  value: string
  /** Set on the Closes row so the page can render a machine-readable <time>. */
  dateTime?: string
}

type FactInput = Pick<
  JobDetails,
  | 'employment_type'
  | 'workplace_type'
  | 'salary_min'
  | 'salary_max'
  | 'salary_period'
  | 'closes_at'
>

/**
 * The rows of the fact sheet: Type, Where, Pay, Closes. A row with nothing to say
 * is left out, except Closes, which reads "Open until filled" with no date.
 * A remote role says Remote once, in Where; Type then carries only the kind of work.
 */
export function buildJobFacts(
  job: FactInput,
  city: { name: string; state_abbr?: string | null } | null | undefined,
  now: Date = new Date()
): JobFact[] {
  const kind = JOB_EMPLOYMENT_TYPE_META[job.employment_type as JobEmploymentType]?.label ?? null
  const isRemote = job.workplace_type === 'remote'
  const mode = isRemote
    ? null
    : (JOB_WORKPLACE_TYPE_META[job.workplace_type as JobWorkplaceType]?.label ?? null)
  const type = [kind, mode].filter(Boolean).join(', ')
  const where = buildJobPlace(city, job.workplace_type)
  const pay = formatJobPay(job.employment_type, job.salary_min, job.salary_max, job.salary_period)
  const closeDate = job.closes_at ? formatCloseDate(job.closes_at, 'long') : null

  const rows: JobFact[] = []
  if (type) rows.push({ label: 'Type', value: type })
  if (where) rows.push({ label: 'Where', value: where })
  if (pay) rows.push({ label: 'Pay', value: pay })
  if (closeDate && job.closes_at) {
    rows.push({
      label: isRoleClosed(job.closes_at, now) ? 'Closed' : 'Closes',
      value: closeDate,
      dateTime: job.closes_at,
    })
  } else {
    rows.push({ label: 'Closes', value: 'Open until filled' })
  }
  return rows
}
