import Link from 'next/link'
import { Handshake } from 'lucide-react'

import { isFeatureEnabled } from '@/lib/env'
import type { PostingReadiness } from '@/lib/jobs/postingReadiness'
import { PostingChecklist } from '@/components/jobs/PostingChecklist'

interface Props {
  /** Where the owner stands on posting (ticket 156); null hides the card. */
  readiness: PostingReadiness | null
  /** From postJobQuotaLine(); null hides the count (quota read failed). */
  quotaLine: string | null
}

const buttonCls =
  'inline-flex min-h-12 w-full shrink-0 items-center justify-center rounded-full px-6 font-subhead text-sm font-semibold sm:ml-auto sm:w-auto'

/**
 * "Post a job" on the dashboard overview (tickets 154 and 156). Invisible unless
 * Jobs is open and posting is on. With a live page it links to /add-job; before
 * that it shows the step the owner is on and a disabled button that says why.
 * The count line is optional so a failed quota read never hides the button.
 */
export function PostJobCard({ readiness, quotaLine }: Props) {
  if (!isFeatureEnabled('jobsOpen') || !isFeatureEnabled('postingSubmissions')) return null
  if (!readiness) return null

  const live = readiness.state === 'live'

  return (
    <section
      aria-labelledby="post-job-heading"
      className="flex flex-col gap-4 rounded-xl border border-charcoal/10 bg-white px-5 py-4"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex min-w-0 items-start gap-3">
          <Handshake className="mt-0.5 size-5 shrink-0 text-amber" aria-hidden="true" />
          <div className="min-w-0">
            <h2 id="post-job-heading" className="font-subhead text-sm font-semibold text-brand-black">
              Hiring?
            </h2>
            {live && quotaLine && <p className="mt-0.5 font-body text-sm text-charcoal">{quotaLine}</p>}
            {!live && (
              <p id="post-job-reason" className="mt-0.5 font-body text-sm text-charcoal">
                Your page needs to be live first.
              </p>
            )}
          </div>
        </div>
        {live ? (
          <Link
            href="/add-job"
            className={`${buttonCls} bg-amber-gold text-brand-black transition-colors hover:bg-light-gold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber`}
          >
            Post a job
          </Link>
        ) : (
          <button
            type="button"
            aria-disabled="true"
            aria-describedby="post-job-reason"
            className={`${buttonCls} cursor-not-allowed border border-charcoal/15 bg-off-white text-charcoal-soft`}
          >
            Post a job
          </button>
        )}
      </div>
      {!live && <PostingChecklist readiness={readiness} compact />}
    </section>
  )
}
