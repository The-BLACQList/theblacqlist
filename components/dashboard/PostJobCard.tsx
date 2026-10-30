import Link from 'next/link'
import { Handshake } from 'lucide-react'

import { isFeatureEnabled } from '@/lib/env'

interface Props {
  /** Signed-in user owns at least one published business page. */
  hasPublishedBusiness: boolean
  /** From postJobQuotaLine(); null hides the count (quota read failed). */
  quotaLine: string | null
}

/**
 * "Post a job" on the dashboard overview (ticket 154). Invisible unless Jobs is
 * open and posting is on, and unless the owner has a published business to hire
 * for. The count line is optional so a failed quota read never hides the button.
 */
export function PostJobCard({ hasPublishedBusiness, quotaLine }: Props) {
  if (!isFeatureEnabled('jobsOpen') || !isFeatureEnabled('postingSubmissions')) return null
  if (!hasPublishedBusiness) return null

  return (
    <section
      aria-labelledby="post-job-heading"
      className="flex flex-col gap-4 rounded-xl border border-charcoal/10 bg-white px-5 py-4 sm:flex-row sm:items-center"
    >
      <div className="flex min-w-0 items-start gap-3">
        <Handshake className="mt-0.5 size-5 shrink-0 text-amber" aria-hidden="true" />
        <div className="min-w-0">
          <h2 id="post-job-heading" className="font-subhead text-sm font-semibold text-brand-black">
            Hiring?
          </h2>
          {quotaLine && <p className="mt-0.5 font-body text-sm text-charcoal">{quotaLine}</p>}
        </div>
      </div>
      <Link
        href="/add-job"
        className="inline-flex min-h-12 w-full shrink-0 items-center justify-center rounded-full bg-amber-gold px-6 font-subhead text-sm font-semibold text-brand-black transition-colors hover:bg-light-gold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber sm:ml-auto sm:w-auto"
      >
        Post a job
      </Link>
    </section>
  )
}
