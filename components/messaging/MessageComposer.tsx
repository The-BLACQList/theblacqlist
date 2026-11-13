'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import type { Route } from 'next'
import { CheckCircle, Loader2 } from 'lucide-react'
import { startConversationAction } from '@/lib/actions/messaging/startConversation'
import { COMPOSE_HASH, CUSTOMER_INBOX_PATH, MESSAGE_MAX_LENGTH, OWNER_INBOX_PATH } from '@/lib/messaging/constants'
import { TurnstileWidget } from '@/components/security/TurnstileWidget'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface SendAsPage {
  id: string
  name: string
}

interface Props {
  listingId: string
  businessName: string
  /** The sender's own published pages. Non-empty shows "Send as" (default: me). */
  sendAsPages?: SendAsPage[]
}

/**
 * The listing page's "Send Message" composer (decision 2026-11-13). Mounted
 * once per page, only when this viewer can start a conversation. Every message
 * CTA on the page points at #send-message (getCtaHref), so this listens for
 * clicks on those links rather than each template rendering its own dialog.
 * It also opens when the page loads with #send-message in the URL.
 */
export function MessageComposer({ listingId, businessName, sendAsPages = [] }: Props) {
  const [open, setOpen] = useState(false)
  // A new form (and a fresh action state) every time the dialog opens after a send.
  const [round, setRound] = useState(0)

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey) return
      const link = (event.target as Element | null)?.closest?.(`a[href="${COMPOSE_HASH}"]`)
      if (!link) return
      event.preventDefault()
      setOpen(true)
    }
    function onHash() {
      if (window.location.hash === COMPOSE_HASH) setOpen(true)
    }
    onHash()
    document.addEventListener('click', onClick)
    window.addEventListener('hashchange', onHash)
    return () => {
      document.removeEventListener('click', onClick)
      window.removeEventListener('hashchange', onHash)
    }
  }, [])

  function onOpenChange(next: boolean) {
    setOpen(next)
    if (!next && window.location.hash === COMPOSE_HASH) {
      // Drop the hash so Back does not reopen the dialog.
      history.replaceState(null, '', window.location.pathname + window.location.search)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader className="px-5 py-4 pr-12 border-b border-charcoal/10">
          <DialogTitle>Message {businessName}</DialogTitle>
          <DialogDescription className="font-body text-sm text-charcoal-soft">
            The business will see your message and your display name, and reply here on The BLACQList.
          </DialogDescription>
        </DialogHeader>
        <ComposerForm
          key={round}
          listingId={listingId}
          businessName={businessName}
          sendAsPages={sendAsPages}
          onSent={() => setRound((r) => r + 1)}
        />
      </DialogContent>
    </Dialog>
  )
}

function ComposerForm({
  listingId,
  businessName,
  sendAsPages,
  onSent,
}: {
  listingId: string
  businessName: string
  sendAsPages: SendAsPage[]
  onSent: () => void
}) {
  const [state, formAction, isPending] = useActionState(startConversationAction, null)
  const [body, setBody] = useState('')
  const [asListingId, setAsListingId] = useState('')
  // Page owners read every thread in the dashboard inbox (Businesses tab).
  const inboxPath = sendAsPages.length > 0 ? OWNER_INBOX_PATH : CUSTOMER_INBOX_PATH
  const sent = Boolean(state && 'success' in state)
  const sentHeading = useRef<HTMLParagraphElement>(null)

  // The form is gone once it sends: move focus to the confirmation so keyboard
  // and screen-reader users land on it instead of the dialog's edge.
  useEffect(() => {
    if (sent) sentHeading.current?.focus()
  }, [sent])

  if (state && 'success' in state) {
    return (
      <div className="px-5 py-8 text-center" role="status" aria-live="polite">
        <CheckCircle className="size-10 text-green-600 mx-auto mb-3" aria-hidden="true" />
        <p
          ref={sentHeading}
          tabIndex={-1}
          className="font-subhead text-base font-semibold text-brand-black mb-1 focus:outline-none"
        >
          Message sent to {businessName}
        </p>
        <p className="font-body text-sm text-charcoal-soft mb-5">
          We&apos;ll show their reply in your messages. You&apos;ll see a badge when they write back.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link
            href={`${inboxPath}/${state.conversationId}` as Route}
            className="inline-flex items-center h-11 px-5 rounded-full bg-gold hover:bg-light-gold text-brand-black font-subhead font-bold text-sm transition-colors"
          >
            View conversation
          </Link>
          <DialogClose
            onClick={onSent}
            className="inline-flex items-center h-11 px-5 rounded-full bg-charcoal/8 text-brand-black font-subhead font-semibold text-sm hover:bg-charcoal/15 transition-colors"
          >
            Close
          </DialogClose>
        </div>
      </div>
    )
  }

  const remaining = MESSAGE_MAX_LENGTH - body.length

  return (
    <form action={formAction} className="px-5 py-4 space-y-3">
      <input type="hidden" name="listing_id" value={listingId} />
      {sendAsPages.length > 0 && (
        <fieldset className="space-y-1.5">
          <legend className="font-subhead text-xs font-semibold text-charcoal-soft mb-1">Send as</legend>
          <div className="flex flex-wrap gap-2">
            {[{ id: '', name: 'Me' }, ...sendAsPages].map((p) => (
              <label
                key={p.id || 'me'}
                className="inline-flex items-center gap-2 h-9 px-3 rounded-full border border-charcoal/15 bg-white font-subhead text-xs font-semibold text-brand-black cursor-pointer has-[:checked]:bg-brand-black has-[:checked]:text-white has-[:checked]:border-brand-black has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-amber-gold"
              >
                <input
                  type="radio"
                  name="as_listing_id"
                  value={p.id}
                  checked={asListingId === p.id}
                  onChange={() => setAsListingId(p.id)}
                  className="sr-only"
                />
                {p.name}
              </label>
            ))}
          </div>
          <p className="font-body text-xs text-charcoal-soft">
            {asListingId
              ? 'The business sees your page’s name and logo.'
              : 'The business sees your display name.'}
          </p>
        </fieldset>
      )}
      <label htmlFor="message-body" className="sr-only">
        Your message
      </label>
      <textarea
        id="message-body"
        name="body"
        required
        rows={6}
        maxLength={MESSAGE_MAX_LENGTH}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Hi! I'd like to ask about…"
        className="w-full rounded-lg border border-charcoal/15 bg-white px-3 py-2.5 font-body text-sm text-brand-black placeholder:text-charcoal-soft/70 focus:outline-none focus:ring-2 focus:ring-amber-gold/40 resize-y"
      />
      <div className="flex items-center justify-between gap-3">
        <p className="font-body text-xs text-charcoal-soft" aria-live="polite">
          {remaining < 200 ? `${remaining} characters left` : 'Be kind. Never share passwords or card numbers.'}
        </p>
      </div>

      <TurnstileWidget resetKey={state} />

      {state && 'error' in state && (
        <p role="alert" className="font-body text-sm text-red-700">
          {state.error}
        </p>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isPending || body.trim().length === 0}
          className="inline-flex items-center gap-2 h-11 px-6 rounded-full bg-gold hover:bg-light-gold text-brand-black font-subhead font-bold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          Send
        </button>
      </div>
    </form>
  )
}
