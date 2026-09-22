'use client'

import { useActionState, useId } from 'react'

import { updateProblemReportAction } from '@/lib/actions/admin/updateProblemReport'
import type { ProblemReportStatus } from '@/lib/feedback/problem-report'

interface Props {
  reportId: string
  status: ProblemReportStatus
  prRef: string | null
}

// The action row on /admin/feedback. Modeled on QueueItemActions: one form
// per transition, hidden inputs, errors inline. Which buttons show depends on
// where the report is:
//
//   new       -> Mark triaged · Mark fixed · Dismiss
//   triaged   -> Mark fixed · Dismiss
//   fixed     -> Reopen
//   dismissed -> Reopen
//
// The PR ref input is shared by the Mark fixed form only; typing a ref and
// clicking Mark triaged would silently drop it, so it lives inside that form.
export function ProblemReportActions({ reportId, status, prRef }: Props) {
  const [triageState, triageDispatch, triagePending] = useActionState(
    updateProblemReportAction,
    null
  )
  const [fixState, fixDispatch, fixPending] = useActionState(updateProblemReportAction, null)
  const [dismissState, dismissDispatch, dismissPending] = useActionState(
    updateProblemReportAction,
    null
  )
  const [reopenState, reopenDispatch, reopenPending] = useActionState(
    updateProblemReportAction,
    null
  )
  const prRefId = useId()

  const isPending = triagePending || fixPending || dismissPending || reopenPending
  const error =
    (triageState as { error?: string } | null)?.error ??
    (fixState as { error?: string } | null)?.error ??
    (dismissState as { error?: string } | null)?.error ??
    (reopenState as { error?: string } | null)?.error

  const closed = status === 'fixed' || status === 'dismissed'

  return (
    <div className="flex flex-col gap-2">
      {error && <p className="font-body text-xs text-red-600">{error}</p>}
      {closed ? (
        <form action={reopenDispatch}>
          <input type="hidden" name="report_id" value={reportId} />
          <input type="hidden" name="status" value="new" />
          <button
            type="submit"
            disabled={isPending}
            className="font-subhead text-xs font-semibold text-charcoal-soft hover:text-charcoal disabled:opacity-50"
          >
            Reopen
          </button>
        </form>
      ) : (
        <>
          <div className="flex items-center gap-2">
            {status === 'new' && (
              <>
                <form action={triageDispatch}>
                  <input type="hidden" name="report_id" value={reportId} />
                  <input type="hidden" name="status" value="triaged" />
                  <button
                    type="submit"
                    disabled={isPending}
                    className="font-subhead text-xs font-semibold text-amber hover:text-brand-black disabled:opacity-50"
                  >
                    Mark triaged
                  </button>
                </form>
                <span className="text-charcoal/20">·</span>
              </>
            )}
            <form action={dismissDispatch}>
              <input type="hidden" name="report_id" value={reportId} />
              <input type="hidden" name="status" value="dismissed" />
              <button
                type="submit"
                disabled={isPending}
                className="font-subhead text-xs font-semibold text-charcoal-soft hover:text-charcoal disabled:opacity-50"
              >
                Dismiss
              </button>
            </form>
          </div>
          <form action={fixDispatch} className="flex items-center gap-2">
            <input type="hidden" name="report_id" value={reportId} />
            <input type="hidden" name="status" value="fixed" />
            <label htmlFor={prRefId} className="sr-only">
              PR reference
            </label>
            <input
              id={prRefId}
              name="pr_ref"
              type="text"
              defaultValue={prRef ?? ''}
              placeholder="PR #"
              maxLength={64}
              className="w-20 rounded-md border border-charcoal/15 bg-white px-2 py-1 font-body text-xs text-charcoal placeholder:text-charcoal-faint focus:border-amber-gold focus:outline-none focus:ring-1 focus:ring-amber-gold/40"
            />
            <button
              type="submit"
              disabled={isPending}
              className="font-subhead text-xs font-semibold text-green-700 hover:text-green-900 disabled:opacity-50"
            >
              Mark fixed
            </button>
          </form>
        </>
      )}
    </div>
  )
}
