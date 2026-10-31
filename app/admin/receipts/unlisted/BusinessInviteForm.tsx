'use client'

import { useActionState, useId, useState } from 'react'

import { sendBusinessInviteAction } from '@/lib/actions/spend/unlistedInvite'
import type { SendBusinessInviteState } from '@/lib/actions/spend/unlistedInvite'
import {
  BUSINESS_INVITE_ADDRESS,
  BUSINESS_INVITE_STOP_LINE,
  BUSINESS_INVITE_SUBJECT,
  businessInviteBody,
  formatShortDate,
} from '@/lib/spend/unlisted'

interface Props {
  businessName: string
  /** The last send, or null when this business has never been emailed. */
  emailedAt: string | null
  /** The business said STOP. The button stays off for good. */
  optedOut: boolean
  siteUrl: string
}

/** A loose shape check so Preview only opens on something address-like. The server validates for real. */
const LOOKS_LIKE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const primaryBtn =
  'inline-flex items-center justify-center h-11 px-5 rounded-full bg-amber-gold hover:bg-light-gold text-brand-black font-subhead font-bold text-sm transition-colors disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-gold/60'
const secondaryBtn =
  'inline-flex items-center justify-center h-11 px-5 rounded-full border border-charcoal/15 bg-white hover:bg-charcoal/5 text-brand-black font-subhead font-bold text-sm transition-colors disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-gold/60'
const linkBtn =
  'inline-flex items-center min-h-11 font-body text-xs font-semibold text-charcoal-soft underline underline-offset-2 hover:text-brand-black transition-colors'

/**
 * "Email this business" (ticket 168, O2 B). The founder types the address,
 * reads the exact email, then sends it. One send per click. A business that
 * has been emailed before needs a second, explicit "Send again", checked here
 * and again on the server.
 */
export function BusinessInviteForm({ businessName, emailedAt, optedOut, siteUrl }: Props) {
  const [state, action, pending] = useActionState<SendBusinessInviteState, FormData>(
    sendBusinessInviteAction,
    null
  )
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [previewing, setPreviewing] = useState(false)
  const [confirming, setConfirming] = useState(false)
  // A server "needs confirm" the founder already cancelled stays dismissed.
  const [dismissed, setDismissed] = useState<SendBusinessInviteState>(null)
  // The state a finished send left behind, so the panel closes once per send.
  const [handled, setHandled] = useState<SendBusinessInviteState>(null)
  const emailId = useId()

  const sent = state && 'success' in state ? state : null
  const lastEmailedAt = sent?.emailedAt ?? emailedAt
  const serverConfirm = state && 'needsConfirm' in state && state !== dismissed ? state : null
  const showConfirm = confirming || Boolean(serverConfirm)
  const confirmDate = serverConfirm?.emailedAt ?? lastEmailedAt

  // Close and reset after a successful send, during render rather than in an
  // effect (the React-recommended way to adjust state on a prop/state change).
  if (sent && handled !== state) {
    setHandled(state)
    setOpen(false)
    setPreviewing(false)
    setConfirming(false)
    setEmail('')
  }

  if (optedOut) {
    return (
      <button type="button" disabled className={secondaryBtn} aria-describedby={`${emailId}-off`}>
        Email this business
        <span id={`${emailId}-off`} className="sr-only">
          {' '}
          Off: {businessName} said STOP.
        </span>
      </button>
    )
  }

  if (!open) {
    return (
      <div className="space-y-1">
        <button type="button" onClick={() => setOpen(true)} className={secondaryBtn}>
          Email this business
          <span className="sr-only">: {businessName}</span>
        </button>
        {sent && (
          <p role="status" className="font-body text-xs text-green-800">
            Sent. Emailed on {formatShortDate(sent.emailedAt)}.{sent.note ? ` ${sent.note}` : ''}
          </p>
        )}
      </div>
    )
  }

  const canPreview = LOOKS_LIKE_EMAIL.test(email.trim())

  function cancel() {
    setOpen(false)
    setPreviewing(false)
    setConfirming(false)
    setDismissed(state)
  }

  return (
    <form action={action} className="w-full space-y-3 rounded-lg border border-charcoal/10 p-4">
      <input type="hidden" name="business_name" value={businessName} />
      {showConfirm && <input type="hidden" name="confirm" value="yes" />}

      <div className="space-y-1">
        <label
          htmlFor={emailId}
          className="block font-subhead text-sm font-semibold text-brand-black"
        >
          Business email
        </label>
        <p className="font-body text-xs text-charcoal-soft">
          Used for this one email. We don&apos;t save it.
        </p>
        <input
          id={emailId}
          name="email"
          type="email"
          inputMode="email"
          autoComplete="off"
          maxLength={254}
          required
          value={email}
          readOnly={previewing}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg border border-charcoal/20 bg-white px-3 py-2.5 font-body text-sm text-brand-black read-only:bg-charcoal/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-gold/60"
        />
      </div>

      {state && 'error' in state && state !== dismissed && (
        <p role="alert" className="font-body text-xs text-red-700">
          {state.error}
        </p>
      )}

      {!previewing ? (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={!canPreview}
            onClick={() => setPreviewing(true)}
            className={primaryBtn}
          >
            Preview email
          </button>
          <button type="button" onClick={cancel} className={linkBtn}>
            Cancel
          </button>
        </div>
      ) : (
        <>
          <section
            aria-label="Email preview"
            className="rounded-lg bg-charcoal/5 p-4 space-y-2 font-body text-sm text-brand-black"
          >
            <p>
              <span className="font-semibold">To:</span> {email.trim()}
            </p>
            <p>
              <span className="font-semibold">Subject:</span> {BUSINESS_INVITE_SUBJECT}
            </p>
            <p className="break-words">{businessInviteBody(businessName, siteUrl)}</p>
            <p className="font-semibold">Button: Add your business</p>
            <hr className="border-charcoal/10" />
            <p className="text-xs text-charcoal-soft">{BUSINESS_INVITE_ADDRESS}</p>
            <p className="text-xs text-charcoal-soft">{BUSINESS_INVITE_STOP_LINE}</p>
            <p className="text-xs text-charcoal-soft">Replies go to your own email address.</p>
          </section>

          {showConfirm ? (
            <div className="space-y-2" role="group" aria-label="Send again?">
              <p className="font-body text-sm text-brand-black">
                {confirmDate
                  ? `${businessName} was already emailed on ${formatShortDate(confirmDate)}. Send again?`
                  : `${businessName} was already emailed. Send again?`}
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <button type="submit" disabled={pending} className={primaryBtn}>
                  {pending ? 'Sending…' : 'Send again'}
                </button>
                <button type="button" onClick={cancel} className={linkBtn}>
                  Don&apos;t send
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              {lastEmailedAt ? (
                <button type="button" onClick={() => setConfirming(true)} className={primaryBtn}>
                  Send email
                </button>
              ) : (
                <button type="submit" disabled={pending} className={primaryBtn}>
                  {pending ? 'Sending…' : 'Send email'}
                </button>
              )}
              <button type="button" onClick={() => setPreviewing(false)} className={linkBtn}>
                Change address
              </button>
              <button type="button" onClick={cancel} className={linkBtn}>
                Cancel
              </button>
            </div>
          )}
        </>
      )}
    </form>
  )
}
