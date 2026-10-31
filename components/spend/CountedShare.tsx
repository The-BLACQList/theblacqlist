'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, Share2 } from 'lucide-react'

import { copyToClipboard } from '@/lib/clipboard'
import { buildCountedShare, countedShareMessage } from '@/lib/spend/counted-share'

interface Props {
  origin: string
  businessName: string
  businessPath: string | null
  businessNameOptIn: boolean
  amountCents: number
}

type Outcome = 'idle' | 'copied' | 'manual'

const shareBtnCls =
  'inline-flex items-center justify-center gap-2 h-11 px-5 rounded-full border border-charcoal/15 bg-white hover:bg-charcoal/5 text-brand-black font-subhead font-bold text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-gold/60'

/**
 * Share card on the counted screen (ticket 166, Part C). Same pattern as
 * components/entity-page/ShareButton.tsx: the share sheet when there is one,
 * the clipboard when there isn't, and the text selected for copying by hand
 * when the clipboard refuses. A cancelled share does nothing.
 */
export function CountedShare({
  origin,
  businessName,
  businessPath,
  businessNameOptIn,
  amountCents,
}: Props) {
  const [includeAmount, setIncludeAmount] = useState(false)
  const [outcome, setOutcome] = useState<Outcome>('idle')
  const manualRef = useRef<HTMLTextAreaElement>(null)

  const share = buildCountedShare({
    origin,
    businessName,
    businessPath,
    businessNameOptIn,
    amountCents,
    includeAmount,
  })
  const message = countedShareMessage(share)

  useEffect(() => {
    if (outcome === 'manual') manualRef.current?.select()
  }, [outcome, message])

  useEffect(() => {
    if (outcome !== 'copied') return
    const t = setTimeout(() => setOutcome('idle'), 2000)
    return () => clearTimeout(t)
  }, [outcome])

  async function handleShare() {
    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      try {
        await navigator.share({ text: share.text, url: share.url })
        return
      } catch (err) {
        // The shopper closed the sheet: nothing happens.
        if (err instanceof DOMException && err.name === 'AbortError') return
        // Any other refusal falls through to the clipboard.
      }
    }
    const result = await copyToClipboard(message)
    setOutcome(result === 'copied' ? 'copied' : 'manual')
  }

  return (
    <div className="w-full mt-8 pt-6 border-t border-charcoal/10 flex flex-col items-center gap-4">
      <div className="flex items-center gap-3">
        <input
          id="counted-share-amount"
          type="checkbox"
          role="switch"
          checked={includeAmount}
          onChange={(e) => setIncludeAmount(e.target.checked)}
          className="size-5 shrink-0 accent-amber-gold"
        />
        <label
          htmlFor="counted-share-amount"
          className="font-subhead text-sm font-semibold text-brand-black"
        >
          Include the amount
        </label>
      </div>

      <button type="button" onClick={handleShare} className={shareBtnCls}>
        {outcome === 'copied' ? (
          <Check className="size-4" aria-hidden="true" />
        ) : (
          <Share2 className="size-4" aria-hidden="true" />
        )}
        {outcome === 'copied' ? 'Copied' : 'Share'}
      </button>

      <p aria-live="polite" className="sr-only">
        {outcome === 'copied' ? 'Copied' : ''}
      </p>

      {outcome === 'manual' && (
        <div className="w-full text-left">
          <label
            htmlFor="counted-share-text"
            className="font-subhead text-xs font-semibold text-brand-black"
          >
            Copy this to share it
          </label>
          <textarea
            id="counted-share-text"
            ref={manualRef}
            readOnly
            rows={3}
            value={message}
            className="mt-1 w-full rounded-lg border border-charcoal/15 bg-white px-3 py-2 font-body text-sm text-brand-black focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-gold/60"
          />
        </div>
      )}

      <p className="font-body text-xs text-charcoal-soft max-w-sm">
        We don&apos;t save what you share.
      </p>
    </div>
  )
}
