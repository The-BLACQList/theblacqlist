import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireOwner } from '@/lib/dashboard/guard'
import { isFeatureEnabled } from '@/lib/env'
import { loadThread } from '@/lib/messaging/loaders'
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
  const thread = await loadThread(supabase, conversationId, owner.user.id)
  if (!thread) notFound()
  // Both sides live here for a page owner (one inbox): threads on their pages,
  // and threads they started with another business. Back goes to its tab.
  const backHref =
    thread.role === 'customer' || thread.sentAsPageName ? `${OWNER_INBOX_PATH}?tab=businesses` : OWNER_INBOX_PATH

  return (
    <div className="max-w-3xl">
      <ThreadView thread={thread} backHref={backHref} backLabel="All messages" />
    </div>
  )
}
