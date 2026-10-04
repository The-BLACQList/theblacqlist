'use client'

import Link from 'next/link'

import { ANALYTICS_EVENTS } from '@/lib/analytics/constants'
import { track } from '@/lib/analytics/client'
import { COMING_SOON_COPY, INSTAGRAM_URL } from '@/lib/marketing/coming-soon-copy'

/** Footer "Follow @theblacqlist" (capture.md section 3, row 11). Fires instagram_follow_click (R6). */
export function InstagramFollowLink() {
  return (
    <Link
      href={INSTAGRAM_URL}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() =>
        track({
          event_name: ANALYTICS_EVENTS.INSTAGRAM_FOLLOW_CLICK,
          properties: { placement: 'footer' },
        })
      }
      className="font-subhead text-sm text-light-gold underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-gold focus-visible:ring-offset-2 focus-visible:ring-offset-deep-bg rounded-sm"
    >
      {COMING_SOON_COPY.instagramFollow}
    </Link>
  )
}
