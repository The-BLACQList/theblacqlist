'use client'

import { useState } from 'react'
import { Share2, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

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

    // Fire analytics event (fire-and-forget)
    void fetch('/api/analytics/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_name: 'listing_shared',
        entity_type: 'listing',
        entity_id: listingId,
        properties: { source: 'entity_page' },
      }),
    }).catch(() => {})

    if (typeof navigator !== 'undefined' && 'share' in navigator) {
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
