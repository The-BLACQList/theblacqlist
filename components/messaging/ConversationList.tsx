import Link from 'next/link'
import type { Route } from 'next'
import { MessageCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatListTime } from '@/lib/messaging/format'
import type { ConversationListItem } from '@/lib/messaging/loaders'

interface Props {
  items: ConversationListItem[]
  /** '/account/messages' or '/dashboard/messages'. */
  basePath: string
  emptyHeading: string
  emptyBody: string
}

export function ConversationList({ items, basePath, emptyHeading, emptyBody }: Props) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center rounded-2xl bg-white border border-charcoal/10">
        <div className="w-14 h-14 rounded-full bg-pale-lavender flex items-center justify-center mb-4">
          <MessageCircle className="size-6 text-charcoal-soft" aria-hidden="true" />
        </div>
        <h2 className="font-headline text-xl text-brand-black mb-2">{emptyHeading}</h2>
        <p className="font-subhead text-sm text-charcoal-soft max-w-sm leading-relaxed">{emptyBody}</p>
      </div>
    )
  }

  return (
    <ul className="rounded-2xl bg-white border border-charcoal/10 divide-y divide-charcoal/8 overflow-hidden">
      {items.map((item) => (
        <li key={item.id}>
          <Link
            href={`${basePath}/${item.id}` as Route}
            className="flex items-center gap-3 px-4 py-3.5 hover:bg-pale-lavender/60 transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-gold"
          >
            <Avatar name={item.title} imageUrl={item.imageUrl} />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-3">
                <p
                  className={cn(
                    'truncate font-subhead text-sm text-brand-black',
                    item.unread ? 'font-bold' : 'font-semibold'
                  )}
                >
                  {item.title}
                  {item.subtitle && (
                    <span className="font-normal text-charcoal-soft"> · {item.subtitle}</span>
                  )}
                </p>
                <time dateTime={item.lastMessageAt} className="shrink-0 font-body text-xs text-charcoal-soft">
                  {formatListTime(item.lastMessageAt)}
                </time>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <p
                  className={cn(
                    'truncate font-body text-sm',
                    item.unread ? 'text-brand-black' : 'text-charcoal-soft'
                  )}
                >
                  {item.preview ?? ' '}
                </p>
                {item.unread && (
                  <span className="ml-auto shrink-0 size-2.5 rounded-full bg-gold" aria-label="Unread" />
                )}
              </div>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  )
}

export function Avatar({ name, imageUrl, size = 'md' }: { name: string; imageUrl: string | null; size?: 'md' | 'lg' }) {
  const box = size === 'lg' ? 'size-11' : 'size-10'
  if (imageUrl) {
    // eslint-disable-next-line @next/next/no-img-element -- avatars and logos come from mixed hosts
    return <img src={imageUrl} alt="" className={cn(box, 'shrink-0 rounded-full object-cover bg-pale-lavender')} />
  }
  return (
    <span
      aria-hidden="true"
      className={cn(
        box,
        'shrink-0 rounded-full bg-brand-black text-gold flex items-center justify-center font-subhead font-bold text-sm'
      )}
    >
      {name.trim().charAt(0).toUpperCase() || '·'}
    </span>
  )
}
