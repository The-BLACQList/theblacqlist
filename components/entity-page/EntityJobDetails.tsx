import Link from 'next/link'
import type { Route } from 'next'

import type { EntityPageData } from '@/types'
import { JobFactSheet } from '@/components/entity-page/job/JobFactSheet'
import { JobHowToApply } from '@/components/entity-page/job/JobHowToApply'
import { JobAboutBusiness } from '@/components/entity-page/job/JobAboutBusiness'
import { JobApplyBar } from '@/components/entity-page/job/JobApplyBar'
import { JobClosedBanner } from '@/components/entity-page/job/JobClosedBanner'
import { buildJobFacts } from '@/lib/listings/jobFacts'
import { formatCloseDate, isRoleClosed } from '@/lib/listings/jobPosting'
import { buildJobPlace } from '@/lib/listings/jobCard'

interface Props {
  entity: EntityPageData
  /** Injected so the closed look can be tested. Defaults to now. */
  now?: Date
}

/**
 * The job page body as a fact sheet (ticket 151): breadcrumb, closed banner, facts,
 * About the role, How to apply, About the business, and a phone-only apply bar.
 * The title and "at {business}" line live in the hero above.
 */
export function EntityJobDetails({ entity, now = new Date() }: Props) {
  const job = entity.job
  if (!job) return null

  const closed = isRoleClosed(job.closes_at, now)
  const closedDate = closed && job.closes_at ? formatCloseDate(job.closes_at, 'long') : null
  const facts = buildJobFacts(job, entity.city, now)
  // apply_url wins over cta_url: it is the field the submit form asks for by name.
  const applyUrl = job.apply_url || job.cta_url || null
  const place = buildJobPlace(entity.city, job.workplace_type)
  const whereHref = entity.city ? `/jobs?where=${encodeURIComponent(entity.city.slug)}` : null

  return (
    <section
      aria-labelledby="job-details-heading"
      className={`bg-white py-8 md:py-12 ${closed ? '' : 'pb-28 md:pb-12'}`}
    >
      <div className="max-w-7xl mx-auto w-full px-4 md:px-6 lg:px-8">
        <h2 id="job-details-heading" className="sr-only">
          Job details
        </h2>
        <div className="md:max-w-3xl space-y-8">
          <nav aria-label="Breadcrumb">
            <ol className="flex items-center gap-1.5 font-body text-xs text-charcoal-soft">
              <li>
                <Link href="/jobs" className="underline underline-offset-2 hover:text-brand-black">
                  Jobs
                </Link>
              </li>
              {place && (
                <>
                  <li aria-hidden="true">/</li>
                  <li>
                    {whereHref && job.workplace_type !== 'remote' ? (
                      <Link
                        href={whereHref as Route}
                        className="underline underline-offset-2 hover:text-brand-black"
                      >
                        {place}
                      </Link>
                    ) : (
                      place
                    )}
                  </li>
                </>
              )}
              <li aria-hidden="true">/</li>
              <li className="text-brand-black truncate max-w-[200px]" aria-current="page">
                {entity.name}
              </li>
            </ol>
          </nav>

          {closedDate && <JobClosedBanner date={closedDate} />}

          <JobFactSheet facts={facts} />

          {job.description && (
            <section aria-labelledby="job-about-heading">
              <h2 id="job-about-heading" className="font-headline text-xl text-brand-black mb-3">
                About the role
              </h2>
              <p className="font-body text-base leading-relaxed text-charcoal whitespace-pre-line">
                {job.description}
              </p>
            </section>
          )}

          {!closed && <JobHowToApply applyUrl={applyUrl} applyEmail={job.apply_email} />}

          {job.hiring && <JobAboutBusiness hiring={job.hiring} />}
        </div>
      </div>
      {!closed && <JobApplyBar applyUrl={applyUrl} applyEmail={job.apply_email} />}
    </section>
  )
}
