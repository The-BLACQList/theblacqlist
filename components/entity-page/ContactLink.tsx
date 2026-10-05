'use client'

import type { AnchorHTMLAttributes } from 'react'

import { trackContactTap, type ContactSource } from '@/lib/analytics/contactTap'

interface Props extends AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string
  listingId: string
  source: ContactSource
}

/**
 * A plain link that records website, call and directions taps. Anything else
 * (email, #visit) passes straight through untracked. Lets the server-rendered
 * hero track its CTA without becoming a client component.
 */
export function ContactLink({ href, listingId, source, onClick, ...rest }: Props) {
  return (
    <a
      href={href}
      onClick={(e) => {
        trackContactTap(listingId, href, source)
        onClick?.(e)
      }}
      {...rest}
    />
  )
}
