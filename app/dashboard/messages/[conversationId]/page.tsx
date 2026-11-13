import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireOwner } from '@/lib/dashboard/guard'
import { isFeatureEnabled } from '@/lib/env'
import { listSavedReplies, loadThread } from '@/lib/messaging/loaders'
import { buildQuickReplies, savedRepliesFor } from '@/lib/messaging/quickReplies'
import { isUuid } from '@/lib/messaging/rules'
import { OWNER_INBOX_PATH } from '@/lib/messaging/constants'
import { ThreadView } from '@/components/messaging/ThreadView'

export const metadata: Metadata = { title: 'Conversation | Dashboard' }

interface Props {
  params: Promise<{ conversationId: string }>
}

export default async function OwnerThreadPage({ params }: Props) {
  if (!isFeatureEnabled('messaging')) notFound()
  const { conversationId } = await params
  if (!isUuid(conversationId)) notFound()

  const owner = await requireOwner()
  const supabase = await createClient()
  const [thread, saved] = await Promise.all([
    loadThread(supabase, conversationId, owner.user.id),
    listSavedReplies(supabase, owner.user.id),
  ])
  if (!thread) notFound()
  // Both sides live here for a page owner (one inbox): threads on their pages
  // and postings, and threads they started with another business. Back goes
  // to its tab.
  const backHref = thread.inboxTab === 'customers' ? OWNER_INBOX_PATH : `${OWNER_INBOX_PATH}?tab=${thread.inboxTab}`
  // Quick replies are for answering people who wrote to me, not for my own
  // questions to other businesses.
  const replies =
    thread.role === 'owner'
      ? {
          quick: thread.quickReplyContext ? buildQuickReplies(thread.quickReplyContext) : [],
          saved: savedRepliesFor(saved, thread.replyKind),
          kind: thread.replyKind,
        }
      : undefined

  return (
    <div className="max-w-3xl">
      <ThreadView thread={thread} backHref={backHref} backLabel="All messages" replies={replies} />
    </div>
  )
}
