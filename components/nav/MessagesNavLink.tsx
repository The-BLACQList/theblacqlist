import Link from 'next/link'
import { MessageCircle } from 'lucide-react'
import { CUSTOMER_INBOX_PATH } from '@/lib/messaging/constants'

/**
 * Header envelope with the unread count. Customers and owners share one count
 * (unread_message_count covers both sides); it opens the customer inbox, which
 * points owners to their dashboard inbox.
 */
export function MessagesNavLink({ unread }: { unread: number }) {
  const label = unread > 0 ? `Messages, ${unread} unread` : 'Messages'
  return (
    <Link
      href={CUSTOMER_INBOX_PATH}
      aria-label={label}
      title="Messages"
      className="relative inline-flex items-center justify-center size-9 rounded-md text-cream hover:text-gold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-gold focus-visible:ring-offset-2 focus-visible:ring-offset-deep-bg"
    >
      <MessageCircle className="h-5 w-5" aria-hidden="true" />
      {unread > 0 && (
        <span
          aria-hidden="true"
          className="absolute -top-0.5 -right-0.5 inline-flex min-w-4 h-4 items-center justify-center rounded-full bg-amber-gold px-1 font-subhead text-[10px] font-bold leading-none text-brand-black"
        >
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </Link>
  )
}
