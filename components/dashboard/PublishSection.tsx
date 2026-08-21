'use client'

import { useActionState, useEffect } from 'react'
import Link from 'next/link'
import { Loader2, CheckCircle, AlertCircle, Globe, EyeOff, Clock } from 'lucide-react'
import { updateListingStatusAction } from '@/lib/actions/dashboard/updateListingStatus'
import { submitListingForReviewAction } from '@/lib/actions/listings/submitListingForReview'

interface Props {
  listingId: string
  status: string
  trustTier: string
  /**
   * `job` and `event` listings are created by `/add-job` and `/add-event`, which
   * leave them `draft` + `unclaimed`. Before this prop existed they fell into the
   * unsubmitted branch below and were pointed at `/add-business` — a flow that
   * cannot submit them — so they could never reach moderation at all. They get a
   * real submit button instead.
   */
  entityType?: string
  /**
   * The owner's included-job-posting position, resolved server-side by the edit
   * page (E-2 Model C). Present only for a draft job that would actually be
   * charged or spend an allowance — absent when the feature is off, when the
   * listing is grandfathered, or when it is already covered by a purchase.
   *
   * ⚠ Display only. Every one of these values is re-derived server-side in
   * `submitListingForReviewAction` before anything is granted or charged; a
   * tampered prop changes the sentence and nothing else.
   *
   * `priceDisplay` is passed in rather than imported so this client component
   * never pulls `lib/stripe/jobPostings.ts` into the browser bundle. The
   * constant stays single-source on the server.
   */
  jobQuota?: { limit: number; used: number; atLimit: boolean; priceDisplay: string }
}

export function PublishSection({
  listingId,
  status: initialStatus,
  trustTier,
  entityType,
  jobQuota,
}: Props) {
  const [state, formAction, isPending] = useActionState(updateListingStatusAction, null)
  const [submitState, submitAction, isSubmitting] = useActionState(
    submitListingForReviewAction,
    null
  )

  // A job posting that needs paying for comes back with a Stripe Checkout URL
  // rather than a success. Nothing has been written at this point — the listing
  // only advances once the webhook confirms the payment.
  useEffect(() => {
    if (submitState && 'requiresPayment' in submitState) {
      window.location.href = submitState.checkoutUrl
    }
  }, [submitState])

  const submitted = submitState !== null && 'success' in submitState

  const currentStatus =
    state && 'success' in state ? state.status : submitted ? 'pending' : initialStatus

  const isSelfSubmittable = entityType === 'job' || entityType === 'event'

  const isPublished = currentStatus === 'published'
  const isPending_ = currentStatus === 'pending'
  const isDraftReviewable = currentStatus === 'draft' && trustTier !== 'unclaimed'
  const isDraftSelfSubmit =
    currentStatus === 'draft' && trustTier === 'unclaimed' && isSelfSubmittable
  const isDraftUnsubmitted =
    currentStatus === 'draft' && trustTier === 'unclaimed' && !isSelfSubmittable

  return (
    <div className="rounded-xl border border-charcoal/10 bg-white">
      <div className="px-5 py-4 border-b border-charcoal/8">
        <h2 className="font-headline text-base text-brand-black">Visibility</h2>
        <p className="font-body text-xs text-charcoal-soft mt-0.5">
          Control whether your listing is visible to the public.
        </p>
      </div>

      <div className="px-5 py-4 space-y-4">
        {/* Current status indicator */}
        <div className="flex items-center gap-2">
          {isPublished && (
            <>
              <Globe className="size-4 text-green-600 shrink-0" aria-hidden="true" />
              <span className="font-subhead text-sm font-semibold text-green-700">Published</span>
              <span className="font-body text-xs text-charcoal-soft">· visible to everyone</span>
            </>
          )}
          {isPending_ && (
            <>
              <Clock className="size-4 text-amber-600 shrink-0" aria-hidden="true" />
              <span className="font-subhead text-sm font-semibold text-amber-700">Under review</span>
            </>
          )}
          {(isDraftReviewable || isDraftUnsubmitted || isDraftSelfSubmit) && (
            <>
              <EyeOff className="size-4 text-charcoal-faint shrink-0" aria-hidden="true" />
              <span className="font-subhead text-sm font-semibold text-charcoal-soft">Draft</span>
              <span className="font-body text-xs text-charcoal-faint">· not visible to the public</span>
            </>
          )}
        </div>

        {/* Pending — read-only message */}
        {isPending_ && (
          <p className="font-body text-sm text-charcoal-soft leading-relaxed">
            Your listing is being reviewed by The BLACQList team. This typically takes 3–5 business
            days. You&apos;ll receive an email when it&apos;s approved.
          </p>
        )}

        {/* Draft + unclaimed — submit for review */}
        {isDraftUnsubmitted && (
          <p className="font-body text-sm text-charcoal-soft leading-relaxed">
            This listing hasn&apos;t been submitted for review yet.{' '}
            <Link
              href="/add-business"
              className="font-semibold text-amber hover:text-light-gold underline underline-offset-2"
            >
              Complete your listing
            </Link>{' '}
            to submit it for review and go live.
          </p>
        )}

        {/* Draft job/event — submit for review directly */}
        {isDraftSelfSubmit && (
          <>
            <p className="font-body text-sm text-charcoal-soft leading-relaxed">
              This {entityType === 'job' ? 'job' : 'event'} hasn&apos;t been submitted for review
              yet. Submit it and The BLACQList team will review it before it goes live.
            </p>
            {jobQuota && (
              <p className="font-body text-sm text-charcoal-soft leading-relaxed">
                {jobQuota.limit === 0 ? (
                  <>
                    Job postings are {jobQuota.priceDisplay} for 30 days. Submitting takes you
                    to checkout.{' '}
                    <Link href="/dashboard/upgrade" className="underline hover:text-brand-black">
                      Growth and Premium plans include free postings
                    </Link>
                    .
                  </>
                ) : jobQuota.atLimit ? (
                  <>
                    {jobQuota.used} of {jobQuota.limit} included postings used in the last 30 days ·
                    additional postings {jobQuota.priceDisplay} for 30 days. Submitting takes
                    you to checkout.
                  </>
                ) : (
                  <>
                    {jobQuota.used} of {jobQuota.limit} included postings used in the last 30 days ·
                    this one is included. It stays live for 30 days.
                  </>
                )}
              </p>
            )}
            {submitState && 'error' in submitState && (
              <div
                role="alert"
                className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2"
              >
                <AlertCircle className="size-4 text-red-500 shrink-0" aria-hidden="true" />
                <p className="font-body text-sm text-red-700">{submitState.error}</p>
              </div>
            )}
            <form action={submitAction}>
              <input type="hidden" name="listing_id" value={listingId} />
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center gap-2 h-9 px-5 rounded-lg bg-amber-gold text-brand-black font-subhead font-bold text-sm hover:bg-light-gold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSubmitting && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                {isSubmitting ? 'Submitting…' : 'Submit for review'}
              </button>
            </form>
          </>
        )}

        {/* Action feedback */}
        {state && 'error' in state && (
          <div
            role="alert"
            className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2"
          >
            <AlertCircle className="size-4 text-red-500 shrink-0" aria-hidden="true" />
            <p className="font-body text-sm text-red-700">{state.error}</p>
          </div>
        )}
        {state && 'success' in state && (
          <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-3 py-2">
            <CheckCircle className="size-4 text-green-600 shrink-0" aria-hidden="true" />
            <p className="font-body text-sm text-green-700">
              {state.status === 'published' ? 'Your listing is now live.' : 'Listing unpublished.'}
            </p>
          </div>
        )}

        {/* Publish action */}
        {isDraftReviewable && (
          <form action={formAction}>
            <input type="hidden" name="listing_id" value={listingId} />
            <input type="hidden" name="action" value="publish" />
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex items-center gap-2 h-9 px-5 rounded-lg bg-amber-gold text-brand-black font-subhead font-bold text-sm hover:bg-light-gold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isPending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              {isPending ? 'Publishing…' : 'Publish listing'}
            </button>
          </form>
        )}

        {/* Unpublish action */}
        {isPublished && (
          <form action={formAction}>
            <input type="hidden" name="listing_id" value={listingId} />
            <input type="hidden" name="action" value="unpublish" />
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex items-center gap-2 h-9 px-5 rounded-lg border border-charcoal/20 text-charcoal font-subhead font-semibold text-sm hover:border-charcoal/40 hover:text-brand-black disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isPending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              {isPending ? 'Unpublishing…' : 'Unpublish'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
