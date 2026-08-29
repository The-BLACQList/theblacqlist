'use client'

import { useActionState, useState } from 'react'
import { Loader2, Flag, CheckCircle } from 'lucide-react'
import { submitCorrectionAction } from '@/lib/actions/corrections/submitCorrection'
import { CORRECTION_ISSUE_TYPES, ISSUE_LABELS } from '@/lib/constants/corrections'
import { cn } from '@/lib/utils'
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from '@/components/ui/dialog'

interface Props {
  listingId: string
  /**
   * Overrides for the dialog trigger only — the dialog contents never change.
   * The default is a small underlined link sized for the bottom of a listing
   * page, which reads as an afterthought on `/corrections`, where reporting IS
   * the page. Presenting the trigger differently is the whole difference, so it
   * is a prop rather than a second component or an auto-open (auto-opening
   * would steal focus on mount from anyone who arrived by keyboard).
   */
  triggerClassName?: string
  triggerLabel?: string
}

export function ReportCorrectionForm({
  listingId,
  triggerClassName,
  triggerLabel = 'Report incorrect information',
}: Props) {
  const [open, setOpen] = useState(false)
  const [state, formAction, isPending] = useActionState(submitCorrectionAction, null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [showOther, setShowOther] = useState(false)

  function toggleIssue(issue: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(issue)) {
        next.delete(issue)
      } else {
        next.add(issue)
      }
      return next
    })
    if (issue === 'other') setShowOther(!selected.has('other'))
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className={
            triggerClassName ??
            'inline-flex items-center gap-1.5 font-subhead text-xs text-charcoal-soft hover:text-charcoal/80 underline underline-offset-2 transition-colors'
          }
        >
          <Flag className={triggerClassName ? 'size-4' : 'size-3'} aria-hidden="true" />
          {triggerLabel}
        </button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader className="px-5 py-4 pr-12 border-b border-charcoal/10">
          <DialogTitle>Report a problem with this listing</DialogTitle>
          <DialogDescription className="sr-only">
            Select the issues you noticed with this listing and optionally describe the problem.
          </DialogDescription>
        </DialogHeader>

        {state && 'success' in state ? (
          <div className="px-5 py-8 text-center" role="status" aria-live="polite">
            <CheckCircle className="size-10 text-green-500 mx-auto mb-3" aria-hidden="true" />
            <p className="font-subhead text-base font-semibold text-brand-black mb-1">
              Thanks. We&apos;re on it.
            </p>
            <p className="font-body text-sm text-charcoal-soft mb-4">
              Our team reviews all reports. We&apos;ll update the listing if the information is
              incorrect.
            </p>
            <DialogClose className="inline-flex items-center h-9 px-5 rounded-lg bg-charcoal/8 text-brand-black font-subhead font-semibold text-sm hover:bg-charcoal/15 transition-colors">
              Close
            </DialogClose>
          </div>
        ) : (
          <form action={formAction} className="px-5 py-4 space-y-4">
            <input type="hidden" name="listing_id" value={listingId} />
            <p className="font-body text-sm text-charcoal-soft">
              Help us keep The BLACQList accurate. Select all that apply.
            </p>

            <fieldset>
              <legend className="sr-only">Select issue types</legend>
              <ul className="space-y-2">
                {CORRECTION_ISSUE_TYPES.map((issue) => (
                  <li key={issue}>
                    <label
                      className={cn(
                        'flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors',
                        selected.has(issue)
                          ? 'border-amber-gold/40 bg-amber-50/40'
                          : 'border-charcoal/12 hover:border-charcoal/20'
                      )}
                    >
                      <input
                        type="checkbox"
                        name="issue_type"
                        value={issue}
                        checked={selected.has(issue)}
                        onChange={() => toggleIssue(issue)}
                        className="rounded border-charcoal/30 text-amber focus:ring-amber-gold/40"
                      />
                      <span className="font-body text-sm text-brand-black">
                        {ISSUE_LABELS[issue]}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </fieldset>

            {showOther && (
              <div>
                <label
                  htmlFor="correction-notes"
                  className="block font-subhead text-xs font-semibold text-charcoal-soft mb-1"
                >
                  Describe the issue{' '}
                  <span className="font-normal text-charcoal-faint">(optional, max 500 chars)</span>
                </label>
                <textarea
                  id="correction-notes"
                  name="notes"
                  rows={3}
                  maxLength={500}
                  placeholder="Please describe what is incorrect…"
                  className="w-full px-3 py-2 rounded-lg border border-charcoal/20 font-body text-sm text-brand-black placeholder:text-charcoal-faint focus:outline-none focus:ring-2 focus:ring-amber-gold/40 resize-none"
                />
              </div>
            )}

            {state && 'error' in state && (
              <p
                role="alert"
                className="font-body text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2"
              >
                {state.error}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <DialogClose className="inline-flex items-center h-9 px-4 rounded-lg bg-charcoal/8 text-brand-black font-subhead font-semibold text-sm hover:bg-charcoal/15 transition-colors">
                Cancel
              </DialogClose>
              <button
                type="submit"
                disabled={isPending || selected.size === 0}
                className="inline-flex items-center gap-2 h-9 px-5 rounded-lg bg-amber-gold text-brand-black font-subhead font-bold text-sm hover:bg-light-gold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isPending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                {isPending ? 'Submitting…' : 'Submit report'}
              </button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
