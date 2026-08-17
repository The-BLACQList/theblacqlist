'use client'

import { useActionState } from 'react'
import { Check, X, Loader2, AlertCircle, ArrowRight } from 'lucide-react'
import { approveSuggestionAction } from '@/lib/actions/ai/approveSuggestion'
import { rejectSuggestionAction } from '@/lib/actions/ai/rejectSuggestion'
import { applySuggestionAction } from '@/lib/actions/ai/applySuggestion'

interface Props {
  suggestionId: string
  status: string
  /** False for captions and summaries — there is no page field to write them into. */
  canApply: boolean
  /** What Apply would overwrite, in the owner's words. */
  applyLabel: string | null
}

const ERROR_CLASS = 'flex items-start gap-1.5 font-body text-xs text-red-600 mt-2'

function ErrorLine({ message }: { message: string }) {
  return (
    <p role="alert" className={ERROR_CLASS}>
      <AlertCircle className="size-3.5 shrink-0 mt-px" aria-hidden="true" />
      {message}
    </p>
  )
}

function ApproveForm({ suggestionId }: { suggestionId: string }) {
  const [state, formAction, isPending] = useActionState(approveSuggestionAction, null)
  return (
    <form action={formAction}>
      <input type="hidden" name="suggestion_id" value={suggestionId} />
      <button
        type="submit"
        disabled={isPending}
        className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full bg-brand-black font-body text-xs font-bold text-white hover:bg-charcoal disabled:opacity-50 transition-colors"
      >
        {isPending ? (
          <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
        ) : (
          <Check className="size-3.5" aria-hidden="true" />
        )}
        Approve
      </button>
      {state && 'error' in state && <ErrorLine message={state.error} />}
    </form>
  )
}

/**
 * Reject, with the reason tucked behind a native `<details>`.
 *
 * Collapsed by default on purpose. The reason is optional (see the note in
 * rejectSuggestion.ts) and a visible empty textarea reads as a required field,
 * which is exactly the friction that would push owners toward approving copy
 * they do not like.
 */
function RejectForm({ suggestionId }: { suggestionId: string }) {
  const [state, formAction, isPending] = useActionState(rejectSuggestionAction, null)
  return (
    <form action={formAction} className="min-w-0">
      <input type="hidden" name="suggestion_id" value={suggestionId} />
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full border border-charcoal/15 bg-white font-body text-xs font-bold text-charcoal-soft hover:text-red-600 hover:border-red-200 disabled:opacity-50 transition-colors"
        >
          {isPending ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <X className="size-3.5" aria-hidden="true" />
          )}
          Reject
        </button>
        <details className="group">
          <summary className="font-body text-xs text-charcoal-faint underline cursor-pointer list-none">
            Add a reason
          </summary>
          <div className="mt-2">
            <label
              htmlFor={`reason-${suggestionId}`}
              className="block font-body text-xs text-charcoal-soft mb-1"
            >
              Why doesn&apos;t this work? (optional)
            </label>
            <textarea
              id={`reason-${suggestionId}`}
              name="reason"
              rows={2}
              maxLength={200}
              className="w-full rounded-lg border border-charcoal/15 px-3 py-2 font-body text-xs text-brand-black focus:outline-none focus:ring-2 focus:ring-amber-gold"
            />
          </div>
        </details>
      </div>
      {state && 'error' in state && <ErrorLine message={state.error} />}
    </form>
  )
}

function ApplyForm({ suggestionId, applyLabel }: { suggestionId: string; applyLabel: string }) {
  const [state, formAction, isPending] = useActionState(applySuggestionAction, null)
  return (
    <form action={formAction}>
      <input type="hidden" name="suggestion_id" value={suggestionId} />
      <button
        type="submit"
        disabled={isPending}
        className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full bg-amber-gold font-body text-xs font-bold text-brand-black hover:bg-light-gold disabled:opacity-50 transition-colors"
      >
        {isPending ? (
          <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
        ) : (
          <ArrowRight className="size-3.5" aria-hidden="true" />
        )}
        Apply to my page
      </button>
      <p className="font-body text-xs text-charcoal-faint mt-1.5">Replaces your {applyLabel}.</p>
      {state && 'error' in state && <ErrorLine message={state.error} />}
    </form>
  )
}

/**
 * The owner-facing controls for one suggestion.
 *
 * Approve and Apply are deliberately two steps, and they are never on screen at
 * the same time: Approve is offered while the suggestion is `pending`, Apply only
 * once it is `approved`. That is the "second confirm before a field update" the
 * safety plan requires, implemented as two states rather than a confirm dialog —
 * the owner can close the tab between them and nothing has changed yet.
 */
export function SuggestionControls({ suggestionId, status, canApply, applyLabel }: Props) {
  if (status === 'pending') {
    return (
      <div className="flex flex-wrap items-start gap-2 mt-3">
        <ApproveForm suggestionId={suggestionId} />
        <RejectForm suggestionId={suggestionId} />
      </div>
    )
  }

  if (status === 'approved') {
    if (!canApply || !applyLabel) {
      return (
        <p className="font-body text-xs text-charcoal-soft mt-3">
          Approved. Copy the text above to use it — there is no page field this one replaces.
        </p>
      )
    }
    return (
      <div className="mt-3">
        <ApplyForm suggestionId={suggestionId} applyLabel={applyLabel} />
      </div>
    )
  }

  return null
}
