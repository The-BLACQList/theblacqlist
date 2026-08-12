import { Briefcase, MapPin, DollarSign, CalendarClock, Send, ExternalLink } from 'lucide-react'
import type { EntityPageData } from '@/types'
import { formatSalary } from '@/lib/listings/jobPosting'
import {
  JOB_EMPLOYMENT_TYPE_META,
  JOB_WORKPLACE_TYPE_META,
  type JobEmploymentType,
  type JobWorkplaceType,
} from '@/lib/constants/listing'

const CTA_LABELS: Record<string, string> = {
  apply: 'Apply now',
  'learn-more': 'Learn more',
  visit: 'Visit',
  contact: 'Contact',
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

export function EntityJobDetails({ entity }: { entity: EntityPageData }) {
  const job = entity.job
  if (!job) return null

  const employmentLabel =
    JOB_EMPLOYMENT_TYPE_META[job.employment_type as JobEmploymentType]?.label ?? job.employment_type
  const workplaceLabel =
    JOB_WORKPLACE_TYPE_META[job.workplace_type as JobWorkplaceType]?.label ?? job.workplace_type

  // Remote roles have no place of work to name; on-site and hybrid inherit the
  // listing's own city, which is the same source buildJobPostingJsonLd uses.
  const whereLine =
    job.workplace_type === 'remote'
      ? 'Remote'
      : entity.city
        ? `${workplaceLabel} — ${entity.city.name}, ${entity.city.state_abbr}`
        : workplaceLabel

  const salaryLine = formatSalary(
    job.salary_min,
    job.salary_max,
    job.salary_period,
    job.salary_currency
  )

  // apply_url wins over cta_url: it is the field the submit form asks for by name.
  // mailto is the fallback so an email-only posting still has a working action.
  const applyHref =
    job.apply_url || job.cta_url || (job.apply_email ? `mailto:${job.apply_email}` : null)
  const isExternal = Boolean(job.apply_url || job.cta_url)
  const ctaLabel = CTA_LABELS[job.cta_type] ?? 'Apply now'

  return (
    <section aria-labelledby="job-details-heading" className="bg-white py-12 md:py-16">
      <div className="max-w-7xl mx-auto w-full px-4 md:px-6 lg:px-8">
        <h2 id="job-details-heading" className="sr-only">
          Job details
        </h2>
        <div className="md:max-w-3xl space-y-6">
          <dl className="grid grid-cols-1 gap-4">
            <div className="flex items-start gap-3">
              <Briefcase className="size-5 text-amber shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <dt className="font-subhead text-xs font-semibold uppercase tracking-wide text-charcoal-soft">
                  Employment type
                </dt>
                <dd className="font-body text-base text-brand-black">{employmentLabel}</dd>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <MapPin className="size-5 text-amber shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <dt className="font-subhead text-xs font-semibold uppercase tracking-wide text-charcoal-soft">
                  Where
                </dt>
                <dd className="font-body text-base text-brand-black">{whereLine}</dd>
              </div>
            </div>

            {salaryLine && (
              <div className="flex items-start gap-3">
                <DollarSign className="size-5 text-amber shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <dt className="font-subhead text-xs font-semibold uppercase tracking-wide text-charcoal-soft">
                    Pay
                  </dt>
                  <dd className="font-body text-base text-brand-black">{salaryLine}</dd>
                </div>
              </div>
            )}

            {job.closes_at && (
              <div className="flex items-start gap-3">
                <CalendarClock className="size-5 text-amber shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <dt className="font-subhead text-xs font-semibold uppercase tracking-wide text-charcoal-soft">
                    Applications close
                  </dt>
                  <dd className="font-body text-base text-brand-black">
                    <time dateTime={job.closes_at}>{fmtDate(job.closes_at)}</time>
                  </dd>
                </div>
              </div>
            )}
          </dl>

          {applyHref && (
            <div className="flex flex-wrap items-center gap-3">
              <a
                href={applyHref}
                {...(isExternal && { target: '_blank', rel: 'noopener noreferrer' })}
                className="inline-flex items-center gap-2 h-12 px-6 rounded-full bg-amber-gold text-brand-black font-subhead text-sm font-bold hover:bg-amber-gold/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-gold/50 transition-colors"
              >
                <Send className="size-4" aria-hidden="true" />
                {ctaLabel}
                {isExternal && <ExternalLink className="size-3.5" aria-hidden="true" />}
              </a>
            </div>
          )}

          <p className="font-body text-sm text-charcoal-soft">
            {job.hiring && (
              <>
                Hiring:{' '}
                <a
                  href={job.hiring.url}
                  className="font-semibold text-brand-black underline decoration-amber-gold/60 underline-offset-2 hover:decoration-amber-gold"
                >
                  {job.hiring.name}
                </a>
                {' · '}
              </>
            )}
            Posted <time dateTime={job.posted_at}>{fmtDate(job.posted_at)}</time>
          </p>

          {job.description && (
            <div className="pt-2 border-t border-charcoal/10">
              <h3 className="font-headline text-lg text-brand-black mt-5 mb-2">About this role</h3>
              <p className="font-body text-sm leading-relaxed text-charcoal whitespace-pre-line">
                {job.description}
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
