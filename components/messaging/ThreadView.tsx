import Link from 'next/link'
import type { Route } from 'next'
import { ArrowLeft, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatMessageTime } from '@/lib/messaging/format'
import type { Thread } from '@/lib/messaging/loaders'
import { Avatar } from './ConversationList'
import { BlockButton } from './BlockButton'
import { MarkConversationRead } from './MarkConversationRead'
import { ReplyBox } from './ReplyBox'
import { ReportDialog } from './ReportDialog'

interface Props {
  thread: Thread
  backHref: string
  backLabel: string
}

/** Shared by /account/messages (customers) and /dashboard/messages (anyone with a page, either side). */
export function ThreadView({ thread, backHref, backLabel }: Props) {
  const isOwner = thread.role === 'owner'

  return (
    <div className="space-y-4">
      <Link
        href={backHref as Route}
        className="inline-flex items-center gap-1.5 font-subhead text-sm font-semibold text-charcoal-soft hover:text-brand-black"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        {backLabel}
      </Link>

      <section className="rounded-2xl bg-white border border-charcoal/10 overflow-hidden">
        <header className="flex flex-wrap items-center gap-3 px-4 py-3.5 border-b border-charcoal/10">
          <Avatar name={thread.counterpartName} imageUrl={thread.counterpartImageUrl} size="lg" />
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-subhead text-base font-bold text-brand-black">{thread.counterpartName}</h1>
            {isOwner ? (
              <p className="truncate font-body text-xs text-charcoal-soft">
                {thread.sentAsPageName ? 'A business, writing to ' : 'About '}
                {thread.listingName}
              </p>
            ) : (
              <p className="flex flex-wrap items-center gap-x-3 font-body text-xs text-charcoal-soft">
                {thread.sentAsPageName && <span>You&apos;re writing as {thread.sentAsPageName}</span>}
                {thread.listingUrl && (
                  <a
                    href={thread.listingUrl}
                    className="inline-flex items-center gap-1 hover:text-brand-black underline underline-offset-2"
                  >
                    View business page
                    <ExternalLink className="size-3" aria-hidden="true" />
                  </a>
                )}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isOwner && (
              <BlockButton
                conversationId={thread.id}
                customerUserId={thread.customerUserId}
                blocked={thread.blockedByMe}
              />
            )}
            <ReportDialog
              conversationId={thread.id}
              role={thread.role}
              counterpartName={thread.counterpartName}
              alreadyBlocked={thread.blockedByMe}
            />
          </div>
        </header>

        <ol className="px-4 py-5 space-y-4 bg-pale-lavender/40" aria-label="Messages">
          {thread.messages.length === 0 && (
            <li className="text-center font-body text-sm text-charcoal-soft">No messages yet.</li>
          )}
          {thread.messages.map((m) => (
            <li key={m.id} className={cn('flex flex-col', m.mine ? 'items-end' : 'items-start')}>
              <div
                className={cn(
                  'max-w-[85%] sm:max-w-[70%] rounded-2xl px-3.5 py-2.5 font-body text-sm whitespace-pre-wrap break-words',
                  m.mine
                    ? 'bg-brand-black text-white rounded-br-md'
                    : 'bg-white text-brand-black border border-charcoal/10 rounded-bl-md'
                )}
              >
                {m.body}
              </div>
              <div className="mt-1 flex items-center gap-2 px-1">
                <time dateTime={m.createdAt} className="font-body text-[11px] text-charcoal-soft">
                  {m.mine ? 'You · ' : ''}
                  {formatMessageTime(m.createdAt)}
                </time>
                {!m.mine && (
                  <ReportDialog
                    conversationId={thread.id}
                    messageId={m.id}
                    role={thread.role}
                    counterpartName={thread.counterpartName}
                    alreadyBlocked={thread.blockedByMe}
                    variant="inline"
                  />
                )}
              </div>
            </li>
          ))}
        </ol>

        <div className="px-4 py-4 border-t border-charcoal/10">
          {thread.canReply ? (
            <ReplyBox conversationId={thread.id} />
          ) : (
            <p role="status" className="rounded-xl bg-charcoal/5 px-4 py-3 font-body text-sm text-charcoal">
              {thread.replyNotice ?? "You can't reply to this conversation."}
            </p>
          )}
        </div>
      </section>

      {thread.unread && <MarkConversationRead conversationId={thread.id} />}
    </div>
  )
}
