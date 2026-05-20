"use client"

import { useActionState, useState } from "react"
import { Loader2, Flag, X, CheckCircle } from "lucide-react"
import { submitCorrectionAction, CORRECTION_ISSUE_TYPES, ISSUE_LABELS } from "@/lib/actions/corrections/submitCorrection"
import { cn } from "@/lib/utils"

interface Props {
  listingId: string
}

export function ReportCorrectionForm({ listingId }: Props) {
  const [open, setOpen] = useState(false)
  const [state, formAction, isPending] = useActionState(submitCorrectionAction, null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [showOther, setShowOther] = useState(false)

  function toggleIssue(issue: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(issue)) { next.delete(issue) } else { next.add(issue) }
      return next
    })
    if (issue === "other") setShowOther(!selected.has("other"))
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 font-subhead text-xs text-charcoal/50 hover:text-charcoal/80 underline underline-offset-2 transition-colors"
      >
        <Flag className="size-3" aria-hidden="true" />
        Report incorrect information
      </button>
    )
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="correction-heading"
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4 bg-brand-black/50"
      onClick={(e) => { if (e.target === e.currentTarget) setOpen(false) }}
    >
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-charcoal/10">
          <h2 id="correction-heading" className="font-headline text-base text-brand-black">
            Report a problem with this listing
          </h2>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close"
            className="inline-flex items-center justify-center size-8 rounded-lg text-charcoal/40 hover:bg-charcoal/5 hover:text-charcoal transition-colors"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>

        {state && "success" in state ? (
          <div className="px-5 py-8 text-center" role="status" aria-live="polite">
            <CheckCircle className="size-10 text-green-500 mx-auto mb-3" aria-hidden="true" />
            <p className="font-subhead text-base font-semibold text-brand-black mb-1">Thanks — we&apos;re on it.</p>
            <p className="font-body text-sm text-charcoal/60 mb-4">
              Our team reviews all reports. We&apos;ll update the listing if the information is incorrect.
            </p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="inline-flex items-center h-9 px-5 rounded-lg bg-charcoal/8 text-brand-black font-subhead font-semibold text-sm hover:bg-charcoal/15 transition-colors"
            >
              Close
            </button>
          </div>
        ) : (
          <form action={formAction} className="px-5 py-4 space-y-4">
            <input type="hidden" name="listing_id" value={listingId} />
            <p className="font-body text-sm text-charcoal/70">
              Help us keep The BLACQList accurate. Select all that apply.
            </p>

            <fieldset>
              <legend className="sr-only">Select issue types</legend>
              <ul className="space-y-2">
                {CORRECTION_ISSUE_TYPES.map((issue) => (
                  <li key={issue}>
                    <label className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors",
                      selected.has(issue)
                        ? "border-amber-gold/40 bg-amber-50/40"
                        : "border-charcoal/12 hover:border-charcoal/20"
                    )}>
                      <input
                        type="checkbox"
                        name="issue_type"
                        value={issue}
                        checked={selected.has(issue)}
                        onChange={() => toggleIssue(issue)}
                        className="rounded border-charcoal/30 text-amber-gold focus:ring-amber-gold/40"
                      />
                      <span className="font-body text-sm text-brand-black">{ISSUE_LABELS[issue]}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </fieldset>

            {showOther && (
              <div>
                <label htmlFor="correction-notes" className="block font-subhead text-xs font-semibold text-charcoal/70 mb-1">
                  Describe the issue <span className="font-normal text-charcoal/40">(optional, max 500 chars)</span>
                </label>
                <textarea
                  id="correction-notes"
                  name="notes"
                  rows={3}
                  maxLength={500}
                  placeholder="Please describe what is incorrect…"
                  className="w-full px-3 py-2 rounded-lg border border-charcoal/20 font-body text-sm text-brand-black placeholder:text-charcoal/40 focus:outline-none focus:ring-2 focus:ring-amber-gold/40 resize-none"
                />
              </div>
            )}

            {state && "error" in state && (
              <p role="alert" className="font-body text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {state.error}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex items-center h-9 px-4 rounded-lg bg-charcoal/8 text-brand-black font-subhead font-semibold text-sm hover:bg-charcoal/15 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending || selected.size === 0}
                className="inline-flex items-center gap-2 h-9 px-5 rounded-lg bg-amber-gold text-brand-black font-subhead font-bold text-sm hover:bg-light-gold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isPending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                {isPending ? "Submitting…" : "Submit report"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
