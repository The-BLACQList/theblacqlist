'use client'

// The "Report a problem" button. One fixed pill in the bottom-left corner of
// every signed-in page, opening a dialog with one textarea. The row lands in
// `problem_reports` and shows up on /admin/feedback the same minute.
//
// Placement: the Tester Tour rail's collapsed pill sits at `bottom-4 right-4`
// (components/tour/TourRail.tsx). This one sits at `bottom-4 left-4` so the
// two never overlap on any viewport, and an enrolled tester sees both without
// either covering the other. Hidden on the same routes the rail hides on
// (lib/tour/routes.ts): a report button floating over the admin console or the
// sign-in form is noise, not help.

import { useActionState, useEffect, useRef, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { usePathname } from 'next/navigation'
import { Loader2, MessageSquareWarning } from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  submitProblemReportAction,
  type SubmitProblemReportState,
} from '@/lib/actions/feedback/submitProblemReport'
import { PROBLEM_REPORT_MAX, PROBLEM_REPORT_MIN } from '@/lib/feedback/problem-report'
import { isHiddenPath } from '@/lib/tour/routes'

function SendButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex min-h-11 items-center gap-2 rounded-full bg-amber-gold px-5 py-2 font-subhead text-sm font-bold text-brand-black transition-colors hover:bg-light-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-gold focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
      {pending ? 'Sending' : 'Send report'}
    </button>
  )
}

function ReportProblemForm({ pagePath }: { pagePath: string }) {
  const [state, action] = useActionState<SubmitProblemReportState, FormData>(
    submitProblemReportAction,
    null
  )
  // CONTROLLED on purpose, same reason as TourReflectionForm: React 19 resets
  // an uncontrolled <form action> when the action resolves, which would wipe
  // the text on a validation failure.
  const [text, setText] = useState('')
  const thanksRef = useRef<HTMLParagraphElement | null>(null)

  const succeeded = state !== null && 'success' in state && state.success
  const error = state !== null && 'error' in state ? state.error : null

  useEffect(() => {
    if (succeeded) thanksRef.current?.focus({ preventScroll: true })
  }, [succeeded])

  if (succeeded) {
    return (
      <p
        ref={thanksRef}
        tabIndex={-1}
        role="status"
        className="mt-2 font-subhead text-sm text-charcoal focus:outline-none"
      >
        Thanks. We read every one of these.
      </p>
    )
  }

  const errorId = error ? 'report-problem-error' : undefined

  return (
    <form action={action} className="mt-2" noValidate>
      <input type="hidden" name="page_path" value={pagePath} />
      <label htmlFor="report-problem-body" className="font-subhead text-sm text-charcoal">
        What went wrong?
      </label>
      <textarea
        id="report-problem-body"
        name="body"
        rows={5}
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={PROBLEM_REPORT_MAX}
        aria-invalid={!!error}
        aria-describedby={errorId}
        placeholder={`What you did, what you expected, what happened instead. At least ${PROBLEM_REPORT_MIN} characters.`}
        className="mt-1.5 w-full rounded-lg border border-charcoal/20 bg-white px-3 py-2 font-body text-sm text-charcoal placeholder:text-charcoal-faint focus:border-amber-gold focus:outline-none focus:ring-2 focus:ring-amber-gold/40"
      />
      <div className="mt-1 flex items-center justify-between">
        <span className="font-body text-xs text-charcoal-faint">
          {text.length}/{PROBLEM_REPORT_MAX}
        </span>
      </div>
      {error && (
        <p id={errorId} role="alert" className="mt-2 font-subhead text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="mt-4 flex justify-end">
        <SendButton />
      </div>
    </form>
  )
}

export function ReportProblemButton() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  if (isHiddenPath(pathname)) return null

  return (
    <div className="fixed bottom-4 left-4 z-40">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <button
            type="button"
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-charcoal/15 bg-white px-4 py-2 font-subhead text-sm text-charcoal shadow-lg transition-colors hover:border-amber-gold/60 hover:text-brand-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-gold focus-visible:ring-offset-2"
          >
            <MessageSquareWarning className="size-4 text-amber" aria-hidden="true" />
            Report a problem
          </button>
        </DialogTrigger>
        {/* key on pathname so a report started on one page does not carry
            its text to the next; a fresh form per page. */}
        <DialogContent key={pathname}>
          <DialogHeader>
            <DialogTitle>Report a problem</DialogTitle>
            <DialogDescription>
              Something broken, confusing, or missing on this page? Tell us here. We read
              every report and reply if we need more detail.
            </DialogDescription>
          </DialogHeader>
          <ReportProblemForm pagePath={pathname} />
        </DialogContent>
      </Dialog>
    </div>
  )
}
