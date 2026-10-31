'use client'

import { useState, useTransition } from 'react'
import { AlertCircle, Mail } from 'lucide-react'

import { updateReceiptEmailsAction } from '@/lib/actions/account/updateReceiptEmails'

interface Props {
  initialOn: boolean
}

/**
 * "Email me when a receipt is counted" (ticket 165). Saves as soon as it is
 * flipped, and flips back with a message if the save fails. Needs-a-fix emails
 * have no switch, and the hint says so.
 */
export function ReceiptEmailsSection({ initialOn }: Props) {
  const [on, setOn] = useState(initialOn)
  const [message, setMessage] = useState<{ kind: 'saved' | 'error'; text: string } | null>(null)
  const [pending, startTransition] = useTransition()

  function onChange(next: boolean) {
    setOn(next)
    setMessage(null)
    startTransition(async () => {
      const result = await updateReceiptEmailsAction(next)
      if ('error' in result) {
        setOn(!next)
        setMessage({ kind: 'error', text: result.error })
      } else {
        setMessage({ kind: 'saved', text: 'Saved.' })
      }
    })
  }

  return (
    <section
      aria-labelledby="receipt-emails-heading"
      className="mt-8 bg-white rounded-2xl border border-charcoal/10 p-6"
    >
      <div className="flex items-center gap-2 mb-4">
        <Mail className="size-4 text-amber-700" aria-hidden="true" />
        <h2 id="receipt-emails-heading" className="font-headline text-lg text-brand-black">
          Receipt emails
        </h2>
      </div>

      <div className="flex items-start gap-3">
        <input
          id="receipt-counted-emails"
          type="checkbox"
          role="switch"
          checked={on}
          disabled={pending}
          onChange={(e) => onChange(e.target.checked)}
          aria-describedby="receipt-counted-emails-hint"
          className="mt-0.5 size-5 shrink-0 accent-amber-gold disabled:opacity-60"
        />
        <div className="min-w-0">
          <label
            htmlFor="receipt-counted-emails"
            className="font-subhead text-sm font-semibold text-brand-black"
          >
            Email me when a receipt is counted
          </label>
          <p id="receipt-counted-emails-hint" className="mt-0.5 font-body text-xs text-charcoal-soft">
            We&apos;ll always email you if a receipt needs a fix.
          </p>
        </div>
      </div>

      <div aria-live="polite" className="min-h-5 mt-3">
        {message?.kind === 'saved' && (
          <p className="font-body text-xs text-charcoal-soft">{message.text}</p>
        )}
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
