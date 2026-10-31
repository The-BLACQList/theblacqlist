'use client'

import { useEffect, useId, useRef, useState } from 'react'

import { copyToClipboard } from '@/lib/clipboard'
import { UNLISTED_INVITE_ACTION, UNLISTED_INVITE_LEAD, inviteMessage } from '@/lib/spend/unlisted'

interface Props {
  /** Absolute site origin for the link. Falls back to the page's own origin. */
  origin?: string
  /** Read to screen readers only, so each invite on a list is told apart. */
  businessName?: string
  className?: string
}

type Outcome = 'idle' | 'copied' | 'manual'

/**
 * "This business isn't on The BLACQList yet. Invite them." (ticket 168). The
 * shopper sends the invite themselves: the share sheet when there is one, the
 * clipboard when there isn't, and the text selected for copying by hand when
 * the clipboard refuses. We send nothing. Same pattern as CountedShare.
 */
export function UnlistedInvite({ origin, businessName, className = '' }: Props) {
  const [outcome, setOutcome] = useState<Outcome>('idle')
  const [message, setMessage] = useState('')
  const manualRef = useRef<HTMLTextAreaElement>(null)
  const textId = useId()

  useEffect(() => {
    if (outcome === 'manual') manualRef.current?.select()
  }, [outcome])

  useEffect(() => {
    if (outcome !== 'copied') return
    const t = setTimeout(() => setOutcome('idle'), 2000)
    return () => clearTimeout(t)
  }, [outcome])

  async function handleInvite() {
    const text = inviteMessage(origin ?? window.location.origin)
    setMessage(text)
    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      try {
        await navigator.share({ text })
        return
      } catch (err) {
        // The shopper closed the sheet: nothing happens.
        if (err instanceof DOMException && err.name === 'AbortError') return
        // Any other refusal falls through to the clipboard.
      }
    }
    const result = await copyToClipboard(text)
    setOutcome(result === 'copied' ? 'copied' : 'manual')
  }

  return (
    <div className={className}>
      <p className="font-body text-xs text-charcoal-soft">
        {UNLISTED_INVITE_LEAD}{' '}
        <button
          type="button"
          onClick={handleInvite}
          className="inline-flex items-center min-h-11 font-subhead text-xs font-semibold text-amber-700 underline underline-offset-2 hover:text-brand-black focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-gold/60 rounded"
        >
          {outcome === 'copied' ? 'Copied' : UNLISTED_INVITE_ACTION}
          {businessName && outcome !== 'copied' && (
            <span className="sr-only"> Invite {businessName} to The BLACQList.</span>
          )}
        </button>
      </p>

      <p aria-live="polite" className="sr-only">
        {outcome === 'copied' ? 'Invite copied. Paste it to the business.' : ''}
      </p>

      {outcome === 'manual' && (
        <div className="mt-1">
          <label htmlFor={textId} className="font-subhead text-xs font-semibold text-brand-black">
            Copy this and send it to the business
          </label>
          <textarea
            id={textId}
            ref={manualRef}
            readOnly
            rows={3}
            value={message}
            className="mt-1 w-full rounded-lg border border-charcoal/15 bg-white px-3 py-2 font-body text-sm text-brand-black focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-gold/60"
          />
        </div>
      )}
    </div>
  )
}
