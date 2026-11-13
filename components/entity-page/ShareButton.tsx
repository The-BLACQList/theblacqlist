'use client'

import { useState } from 'react'
import { Share2 } from 'lucide-react'

import { ShareSheet } from '@/components/share/ShareSheet'
import { track } from '@/lib/analytics/client'
import { ANALYTICS_EVENTS } from '@/lib/analytics/constants'
import { profileCaption } from '@/lib/share/captions'
import { cleanShareUrl } from '@/lib/share/links'
import { cn } from '@/lib/utils'

interface Props {
  listingName: string
  listingId: string
  listingSlug: string
  cityName?: string | null
  categoryName?: string | null
  className?: string
  /** Sizes the icon so a caller can match its own button scale exactly. */
  iconClassName?: string
  tabIndex?: number
}

/**
 * Opens the share sheet for a business. Opening it is `share_sheet_opened`;
 * `share_initiated` fires only when the visitor picks where to share, so the
 * owner dashboard's Shares counts shares, not curiosity.
 */
export function ShareButton({
  listingName,
  listingId,
  listingSlug,
  cityName,
  categoryName,
  className,
  iconClassName,
  tabIndex,
}: Props) {
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState('')

  function handleOpen() {
    setUrl(cleanShareUrl(window.location.href))
    setOpen(true)
    track({
      event_name: ANALYTICS_EVENTS.SHARE_SHEET_OPENED,
      entity_type: 'listing',
      entity_id: listingId,
      properties: { source: 'entity_page' },
    })
  }

  const card = `/api/share-card/listing/${encodeURIComponent(listingSlug)}`

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        tabIndex={tabIndex}
        aria-label="Share this business"
        aria-haspopup="dialog"
        className={cn(
          'inline-flex items-center justify-center size-10 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors',
          className
        )}
      >
        <Share2 className={cn('size-4', iconClassName)} aria-hidden="true" />
      </button>
      {url && (
        <ShareSheet
          open={open}
          onOpenChange={setOpen}
          title={`Share ${listingName}`}
          caption={profileCaption({ businessName: listingName, categoryName, cityName })}
          url={url}
          campaign="profile_share"
          businessName={listingName}
          images={{ story: `${card}?format=story`, feed: `${card}?format=feed` }}
          analytics={{ entityId: listingId, entityType: 'listing', source: 'entity_page' }}
        />
      )}
    </>
  )
}
