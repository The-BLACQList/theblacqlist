'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { AlertCircle, MessageCircle } from 'lucide-react'
import { setInboxOpenAction } from '@/lib/actions/messaging/setInboxOpen'
import { OWNER_INBOX_PATH } from '@/lib/messaging/constants'

interface Props {
  listingId: string
  initialOpen: boolean
}

/**
 * The inbox open/closed switch for one page. Saves as soon as it is flipped and
 * flips back with a message if the save fails (same as ReceiptEmailsSection).
 */
export function InboxSection({ listingId, initialOpen }: Props) {
  const [open, setOpen] = useState(initialOpen)
  const [message, setMessage] = useState<{ kind: 'saved' | 'error'; text: string } | null>(null)
  const [pending, startTransition] = useTransition()

  function onChange(next: boolean) {
    setOpen(next)
    setMessage(null)
    startTransition(async () => {
      const result = await setInboxOpenAction(listingId, next)
      if ('error' in result) {
        setOpen(!next)
        setMessage({ kind: 'error', text: result.error })
      } else {
        setMessage({ kind: 'saved', text: next ? 'Inbox open.' : 'Inbox closed.' })
      }
    })
  }

  return (
    <section aria-labelledby="inbox-heading" className="bg-white rounded-2xl border border-charcoal/10 p-6">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <MessageCircle className="size-4 text-amber-700" aria-hidden="true" />
          <h2 id="inbox-heading" className="font-headline text-lg text-brand-black">
            Messages
          </h2>
        </div>
        <Link
          href={`${OWNER_INBOX_PATH}?listing=${listingId}`}
          className="font-subhead text-xs font-semibold text-brand-black underline underline-offset-2 hover:text-charcoal"
        >
          Go to inbox
        </Link>
      </div>

      <div className="flex items-start gap-3">
        <input
          id="inbox-open"
          type="checkbox"
          role="switch"
          checked={open}
          disabled={pending}
          onChange={(e) => onChange(e.target.checked)}
          aria-describedby="inbox-open-hint"
          className="mt-0.5 size-5 shrink-0 accent-amber-gold disabled:opacity-60"
        />
        <div className="min-w-0">
          <label htmlFor="inbox-open" className="font-subhead text-sm font-semibold text-brand-black">
            Let customers message me
          </label>
          <p id="inbox-open-hint" className="mt-0.5 font-body text-xs text-charcoal-soft">
            When on, customers can message you from your page. Turning it off stops new conversations; you can still
            reply to existing ones.
          </p>
        </div>
      </div>

      <div aria-live="polite" className="min-h-5 mt-3">
        {message?.kind === 'saved' && <p className="font-body text-xs text-charcoal-soft">{message.text}</p>}
        {message?.kind === 'error' && (
          <p role="alert" className="flex items-center gap-1.5 font-body text-xs text-red-700">
            <AlertCircle className="size-3.5 shrink-0" aria-hidden="true" />
            {message.text}
          </p>
        )}
      </div>
    </section>
  )
}
