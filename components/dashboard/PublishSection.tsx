'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { Loader2, CheckCircle, AlertCircle, Globe, EyeOff, Clock } from 'lucide-react'
import { updateListingStatusAction } from '@/lib/actions/dashboard/updateListingStatus'

interface Props {
  listingId: string
  status: string
  trustTier: string
}

export function PublishSection({ listingId, status: initialStatus, trustTier }: Props) {
  const [state, formAction, isPending] = useActionState(updateListingStatusAction, null)

  const currentStatus = state && 'success' in state ? state.status : initialStatus

  const isPublished = currentStatus === 'published'
  const isPending_ = currentStatus === 'pending'
  const isDraftReviewable = currentStatus === 'draft' && trustTier !== 'unclaimed'
  const isDraftUnsubmitted = currentStatus === 'draft' && trustTier === 'unclaimed'

  return (
    <div className="rounded-xl border border-charcoal/10 bg-white">
      <div className="px-5 py-4 border-b border-charcoal/8">
        <h2 className="font-headline text-base text-brand-black">Visibility</h2>
        <p className="font-body text-xs text-charcoal/50 mt-0.5">
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
              <span className="font-body text-xs text-charcoal/50">— visible to everyone</span>
            </>
          )}
          {isPending_ && (
            <>
              <Clock className="size-4 text-amber-600 shrink-0" aria-hidden="true" />
              <span className="font-subhead text-sm font-semibold text-amber-700">Under review</span>
            </>
          )}
          {(isDraftReviewable || isDraftUnsubmitted) && (
            <>
              <EyeOff className="size-4 text-charcoal/40 shrink-0" aria-hidden="true" />
              <span className="font-subhead text-sm font-semibold text-charcoal/60">Draft</span>
              <span className="font-body text-xs text-charcoal/40">— not visible to the public</span>
            </>
          )}
        </div>

        {/* Pending — read-only message */}
        {isPending_ && (
          <p className="font-body text-sm text-charcoal/60 leading-relaxed">
            Your listing is being reviewed by The BLACQList team. This typically takes 3–5 business
            days. You&apos;ll receive an email when it&apos;s approved.
          </p>
        )}

        {/* Draft + unclaimed — submit for review */}
        {isDraftUnsubmitted && (
          <p className="font-body text-sm text-charcoal/60 leading-relaxed">
            This listing hasn&apos;t been submitted for review yet.{' '}
            <Link
              href="/add-business"
              className="font-semibold text-amber-gold hover:text-light-gold underline underline-offset-2"
            >
              Complete your listing
            </Link>{' '}
            to submit it for review and go live.
          </p>
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
