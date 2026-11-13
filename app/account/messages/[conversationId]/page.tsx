import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isFeatureEnabled } from '@/lib/env'
import { loadThread } from '@/lib/messaging/loaders'
import { isUuid } from '@/lib/messaging/rules'
import { CUSTOMER_INBOX_PATH, OWNER_INBOX_PATH } from '@/lib/messaging/constants'
import { ThreadView } from '@/components/messaging/ThreadView'

export const metadata: Metadata = { title: 'Conversation | The BLACQList' }

interface Props {
  params: Promise<{ conversationId: string }>
}

export default async function CustomerThreadPage({ params }: Props) {
  if (!isFeatureEnabled('messaging')) notFound()
  const { conversationId } = await params
  if (!isUuid(conversationId)) notFound()

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/sign-in?next=${encodeURIComponent(`${CUSTOMER_INBOX_PATH}/${conversationId}`)}`)

  const thread = await loadThread(supabase, conversationId, user.id)
  if (!thread) notFound()
  // An owner who follows a customer-side link lands in their own inbox.
  if (thread.role === 'owner') redirect(`${OWNER_INBOX_PATH}/${conversationId}`)

  return (
    <main>
      <div className="max-w-[960px] mx-auto">
        <ThreadView thread={thread} backHref={CUSTOMER_INBOX_PATH} backLabel="All messages" />
      </div>
    </main>
  )
}
