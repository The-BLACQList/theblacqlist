'use client'

import { useActionState, useState } from 'react'
import { CheckCircle, Flag, Loader2 } from 'lucide-react'
import { reportConversationAction } from '@/lib/actions/messaging/reportConversation'
import { REPORT_NOTE_MAX_LENGTH, REPORT_REASONS, REPORT_REASON_LABELS } from '@/lib/messaging/constants'
import type { ParticipantRole } from '@/lib/messaging/rules'
import { cn } from '@/lib/utils'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

interface Props {
  conversationId: string
  /** Report one message rather than the person. */
  messageId?: string
  role: ParticipantRole
  /** Who is being reported, for the title. */
  counterpartName: string
  /** Owner side: the customer is already blocked, so no "Also block" box. */
  alreadyBlocked?: boolean
  variant?: 'button' | 'inline'
}

export function ReportDialog({
  conversationId,
  messageId,
  role,
  counterpartName,
  alreadyBlocked = false,
  variant = 'button',
}: Props) {
  const [open, setOpen] = useState(false)
  const [round, setRound] = useState(0)

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setRound((r) => r + 1)
      }}
    >
      <DialogTrigger asChild>
        {variant === 'inline' ? (
          <button
            type="button"
            className="font-body text-[11px] text-charcoal-soft hover:text-charcoal underline underline-offset-2"
          >
            Report
          </button>
        ) : (
          <button
            type="button"
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full border border-charcoal/15 bg-white font-subhead text-xs font-semibold text-brand-black hover:bg-pale-lavender transition-colors"
          >
            <Flag className="size-3.5" aria-hidden="true" />
            Report
          </button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader className="px-5 py-4 pr-12 border-b border-charcoal/10">
          <DialogTitle>{messageId ? 'Report this message' : `Report ${counterpartName}`}</DialogTitle>
          <DialogDescription className="font-body text-sm text-charcoal-soft">
            Our team reads every report. {counterpartName} won&apos;t be told who reported them.
          </DialogDescription>
        </DialogHeader>
        <ReportForm
          key={round}
          conversationId={conversationId}
          messageId={messageId}
          offerBlock={role === 'owner' && !alreadyBlocked}
        />
      </DialogContent>
    </Dialog>
  )
}

function ReportForm({
  conversationId,
  messageId,
  offerBlock,
}: {
  conversationId: string
  messageId?: string
  offerBlock: boolean
}) {
  const [state, formAction, isPending] = useActionState(reportConversationAction, null)
  const [reason, setReason] = useState<string>('')
  const [note, setNote] = useState('')

  if (state && 'success' in state) {
    return (
      <div className="px-5 py-8 text-center" role="status" aria-live="polite">
        <CheckCircle className="size-10 text-green-600 mx-auto mb-3" aria-hidden="true" />
        <p className="font-subhead text-base font-semibold text-brand-black mb-1">Thanks for telling us</p>
        <p className="font-body text-sm text-charcoal-soft mb-4">
          {state.blocked
            ? "We'll review it. You've also blocked this customer, so they can't message you."
            : "We'll review it and take action if it breaks our rules."}
        </p>
        <DialogClose className="inline-flex items-center h-11 px-5 rounded-full bg-charcoal/8 text-brand-black font-subhead font-semibold text-sm hover:bg-charcoal/15 transition-colors">
          Close
        </DialogClose>
      </div>
    )
  }

  return (
    <form action={formAction} className="px-5 py-4 space-y-4">
      <input type="hidden" name="conversation_id" value={conversationId} />
      {messageId && <input type="hidden" name="message_id" value={messageId} />}

      <fieldset>
        <legend className="font-subhead text-xs font-semibold text-charcoal-soft mb-2">What&apos;s wrong?</legend>
        <ul className="space-y-2">
          {REPORT_REASONS.map((r) => (
            <li key={r}>
              <label
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors',
                  reason === r ? 'border-amber-gold/40 bg-amber-50/40' : 'border-charcoal/12 hover:border-charcoal/20'
                )}
              >
                <input
                  type="radio"
                  name="reason"
                  value={r}
                  required
                  checked={reason === r}
                  onChange={() => setReason(r)}
                  className="border-charcoal/30 text-amber focus:ring-amber-gold/40"
                />
                <span className="font-body text-sm text-brand-black">{REPORT_REASON_LABELS[r]}</span>
              </label>
            </li>
          ))}
        </ul>
      </fieldset>

      <div>
        <label htmlFor="report-note" className="block font-subhead text-xs font-semibold text-charcoal-soft mb-1">
          Anything else? (optional)
        </label>
        <textarea
          id="report-note"
          name="note"
          rows={3}
          maxLength={REPORT_NOTE_MAX_LENGTH}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="w-full rounded-lg border border-charcoal/15 bg-white px-3 py-2 font-body text-sm text-brand-black focus:outline-none focus:ring-2 focus:ring-amber-gold/40 resize-y"
        />
        <p className="mt-1 font-body text-xs text-charcoal-soft text-right">
          {note.length}/{REPORT_NOTE_MAX_LENGTH}
        </p>
      </div>

      {offerBlock && (
        <label className="flex items-center gap-3 font-body text-sm text-brand-black">
          <input
            type="checkbox"
            name="also_block"
            defaultChecked
            className="rounded border-charcoal/30 text-amber focus:ring-amber-gold/40"
          />
          Also block this customer
        </label>
      )}

      {state && 'error' in state && (
        <p role="alert" className="font-body text-sm text-red-700">
          {state.error}
        </p>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isPending || !reason}
          className="inline-flex items-center gap-2 h-11 px-6 rounded-full bg-brand-black text-white font-subhead font-bold text-sm hover:bg-charcoal transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          Send report
        </button>
      </div>
    </form>
  )
}
