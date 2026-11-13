'use client'

import { useEffect, useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { track } from '@/lib/analytics/client'
import { ANALYTICS_EVENTS } from '@/lib/analytics/constants'

// A deal's code with a "Copy code" button (part G). The code is always shown,
// so a visitor can still read it where the clipboard isn't available. Each
// copy records deal_code_copied for the owner's analytics.

interface Props {
  listingId: string
  dealId: string
  code: string
}

export function DealCodeButton({ listingId, dealId, code }: Props) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(t)
  }, [copied])

  async function copy() {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
    } catch {
      // No clipboard (an old browser, or permission refused): the code is on screen.
      return
    }
    track({
      event_name: ANALYTICS_EVENTS.DEAL_CODE_COPIED,
      entity_id: listingId,
      entity_type: 'listing',
      properties: { deal_id: dealId },
    })
  }

  return (
    <div className="flex items-center gap-2 rounded-lg border border-dashed border-charcoal/25 bg-pale-lavender/40 py-1.5 pl-3 pr-1.5">
      <span className="min-w-0 flex-1 truncate font-mono text-sm font-semibold tracking-wide text-brand-black">
        {code}
      </span>
      <button
        type="button"
        onClick={copy}
        aria-label={copied ? `Code ${code} copied` : `Copy code ${code}`}
        className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-brand-black px-3 font-subhead text-xs font-bold text-white hover:bg-charcoal focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-gold/50"
      >
        {copied ? (
          <Check className="size-3.5" aria-hidden="true" />
        ) : (
          <Copy className="size-3.5" aria-hidden="true" />
        )}
        <span aria-live="polite">{copied ? 'Copied' : 'Copy code'}</span>
      </button>
    </div>
  )
}
