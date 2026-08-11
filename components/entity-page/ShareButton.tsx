'use client'

import { useState } from 'react'
import { Share2, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { track } from '@/lib/analytics/client'
import { ANALYTICS_EVENTS } from '@/lib/analytics/constants'

interface Props {
  listingName: string
  listingId: string
  className?: string
  tabIndex?: number
}

export function ShareButton({ listingName, listingId, className, tabIndex }: Props) {
  const [copied, setCopied] = useState(false)

  async function handleShare() {
    const url = window.location.href
    const title = `${listingName} | The BLACQList`
    const canNativeShare = typeof navigator !== 'undefined' && 'share' in navigator

    // Fire-and-forget. Goes through track() so it carries a session_id and uses
    // sendBeacon — which matters here because navigator.share can navigate away
    // before a plain fetch resolves. The hand-rolled fetch this replaced posted
    // 'listing_shared', which is not in ANALYTICS_EVENTS, so the route rejected
    // every share with a 400 and the owner dashboard's Shares was always zero.
    track({
      event_name: ANALYTICS_EVENTS.SHARE_INITIATED,
      entity_type: 'listing',
      entity_id: listingId,
      properties: { source: 'entity_page', method: canNativeShare ? 'native_share' : 'copy_link' },
    })

    if (canNativeShare) {
      try {
        await navigator.share({ title, url })
        return
      } catch {
        // User cancelled or API unavailable — fall through to clipboard
      }
    }

    // Clipboard fallback
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard not available — silently fail
    }
  }

  return (
    <button
      type="button"
      onClick={handleShare}
      tabIndex={tabIndex}
      aria-label={copied ? 'Link copied' : 'Share this business'}
      className={cn(
        'inline-flex items-center justify-center size-10 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors',
        className
      )}
    >
      {copied ? (
        <Check className="size-4" aria-hidden="true" />
      ) : (
        <Share2 className="size-4" aria-hidden="true" />
      )}
    </button>
  )
}
