import Link from 'next/link'
import type { Route } from 'next'
import Image from 'next/image'

import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { formatJobPay } from '@/lib/listings/jobPosting'
import { JOB_EMPLOYMENT_TYPE_META, type JobEmploymentType } from '@/lib/constants/listing'
import type { JobCardData } from '@/types'

interface Props {
  job: JobCardData
  className?: string
  /** Injected so the closed look can be tested. Defaults to now. */
  now?: Date
}

// The deadline is a timestamptz, and a deadline means a day on the calendar in
// the audience's time zone, not a UTC instant. Fixed zone so server and browser agree.
function formatCloseDate(iso: string): string | null {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return null
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/New_York' })
}

const chipClass =
  'inline-flex items-center rounded-full border text-[11px] font-subhead font-semibold px-2 py-0.5'

/**
 * The one job card (ticket 149): business and place, role title, fact chips,
 * closing date. Used on the board, in search and on the business page. The whole
 * card is one link (the title's stretched link), so there is one tab stop per card.
 */
export function JobCard({ job, className, now }: Props) {
  const pay = formatJobPay(job.employmentType, job.salaryMin, job.salaryMax, job.salaryPeriod)
  const kind = job.employmentType
    ? (JOB_EMPLOYMENT_TYPE_META[job.employmentType as JobEmploymentType]?.label ?? null)
    : null
  const isRemote = job.workplaceType === 'remote'
  const closeDate = job.closesAt ? formatCloseDate(job.closesAt) : null
  const isClosed = !!job.closesAt && closeDate !== null && new Date(job.closesAt) < (now ?? new Date())
  const hasChips = !!pay || !!kind || isRemote
  // Remote roles say "Remote" once, on the chip, so the top line drops it.
  const place = isRemote ? null : job.place
  // With no hiring business the top line is the place alone.
  const topLine = job.businessName && place ? `${job.businessName} · ${place}` : null

  return (
    <article
      className={cn(
        'group relative bg-white rounded-xl border border-charcoal/10 shadow-sm hover:shadow-md transition-shadow duration-200 flex flex-col gap-3 p-4 min-h-[44px] has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-amber',
        isClosed && 'opacity-70',
        className
      )}
    >
      {(job.businessName || place) && (
        <div className="flex items-center gap-2 min-w-0">
          {job.businessName && job.businessLogoUrl && (
            <Image
              src={job.businessLogoUrl}
              alt=""
              width={28}
              height={28}
              className="size-7 shrink-0 rounded-full object-cover bg-pale-lavender"
            />
          )}
          <p className="font-subhead text-xs text-charcoal truncate">
            {topLine ?? job.businessName ?? place}
          </p>
        </div>
      )}

      <h3 className="font-headline text-base text-brand-black leading-snug line-clamp-2">
        <Link
          href={job.href as Route}
          className="hover:underline underline-offset-2 focus-visible:outline-none after:absolute after:inset-0 after:content-['']"
        >
          {job.title}
        </Link>
      </h3>

      {hasChips && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Role details">
          {pay && (
            <li className={cn(chipClass, 'border-charcoal/30 text-charcoal')}>{pay}</li>
          )}
          {kind && (
            <li className={cn(chipClass, 'border-jobs/40 bg-jobs/10 text-jobs-ink')}>{kind}</li>
          )}
          {isRemote && (
            <li className={cn(chipClass, 'border-charcoal/30 text-charcoal')}>Remote</li>
          )}
        </ul>
      )}

      {closeDate && (
        <p className="font-subhead text-xs text-charcoal-soft mt-auto pt-1">
          {isClosed ? 'Closed' : 'Closes'} {closeDate}
        </p>
      )}
    </article>
  )
}

/** Same box shape as JobCard: logo circle, two text bars, three chip pills, foot bar. */
export function JobCardSkeleton() {
  return (
    <div
      className="bg-white rounded-xl border border-charcoal/10 flex flex-col gap-3 p-4"
      aria-hidden="true"
    >
      <div className="flex items-center gap-2">
        <Skeleton className="size-7 rounded-full" />
        <Skeleton className="h-3 w-2/3" />
      </div>
      <Skeleton className="h-5 w-4/5" />
      <div className="flex gap-1.5">
        <Skeleton className="h-5 w-20 rounded-full" />
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-5 w-14 rounded-full" />
      </div>
      <Skeleton className="h-3 w-24" />
    </div>
  )
}
