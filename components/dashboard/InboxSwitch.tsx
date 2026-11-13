'use client'

import { useState, useTransition } from 'react'
import { AlertCircle } from 'lucide-react'
import { setInboxOpenAction } from '@/lib/actions/messaging/setInboxOpen'

interface Props {
  listingId: string
  initialOpen: boolean
  /** The switch's label. */
  label?: string
  /** The line under the label. Defaults to the business-page wording. */
  hint?: string
  /** Called after a save succeeds, so a parent can react (the button warning). */
  onSaved?: (open: boolean) => void
}

const DEFAULT_HINT =
  'When on, customers can message you from your page. Turning it off stops new conversations; you can still reply to existing ones.'

/**
 * The inbox open/closed switch for one page. Saves as soon as it is flipped and
 * flips back with a message if the save fails (same as ReceiptEmailsSection).
 * Used in Messages → Inbox settings (one per page) and in the edit page's
 * main-button section.
 */
export function InboxSwitch({ listingId, initialOpen, label = 'Let customers message me', hint = DEFAULT_HINT, onSaved }: Props) {
  const [open, setOpen] = useState(initialOpen)
  const [message, setMessage] = useState<{ kind: 'saved' | 'error'; text: string } | null>(null)
  const [pending, startTransition] = useTransition()
  const id = `inbox-open-${listingId}`

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
        onSaved?.(next)
      }
    })
  }

  return (
    <div>
      <div className="flex items-start gap-3">
        <input
          id={id}
          type="checkbox"
          role="switch"
          checked={open}
          disabled={pending}
          onChange={(e) => onChange(e.target.checked)}
          aria-describedby={`${id}-hint`}
          className="mt-0.5 size-5 shrink-0 accent-amber-gold disabled:opacity-60"
        />
        <div className="min-w-0">
          <label htmlFor={id} className="font-subhead text-sm font-semibold text-brand-black">
            {label}
          </label>
          <p id={`${id}-hint`} className="mt-0.5 font-body text-xs text-charcoal-soft">
            {hint}
          </p>
        </div>
      </div>

      <div aria-live="polite" className="min-h-5 mt-2 pl-8">
        {message?.kind === 'saved' && <p className="font-body text-xs text-charcoal-soft">{message.text}</p>}
        {message?.kind === 'error' && (
          <p role="alert" className="flex items-center gap-1.5 font-body text-xs text-red-700">
            <AlertCircle className="size-3.5 shrink-0" aria-hidden="true" />
            {message.text}
          </p>
        )}
      </div>
    </div>
  )
}
