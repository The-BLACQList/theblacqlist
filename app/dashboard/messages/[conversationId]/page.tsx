import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireOwner } from '@/lib/dashboard/guard'
import { isFeatureEnabled } from '@/lib/env'
import { loadThread } from '@/lib/messaging/loaders'
import { isUuid } from '@/lib/messaging/rules'
import { CUSTOMER_INBOX_PATH, OWNER_INBOX_PATH } from '@/lib/messaging/constants'
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
  // An owner can also be a customer of someone else's business.
  if (thread.role === 'customer') redirect(`${CUSTOMER_INBOX_PATH}/${conversationId}`)

  return (
    <div className="max-w-3xl">
      <ThreadView thread={thread} backHref={OWNER_INBOX_PATH} backLabel="All messages" />
    </div>
  )
}
