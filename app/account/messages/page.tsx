import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isFeatureEnabled } from '@/lib/env'
import { listCustomerConversations } from '@/lib/messaging/loaders'
import Link from 'next/link'
import { CUSTOMER_INBOX_PATH, OWNER_INBOX_PATH } from '@/lib/messaging/constants'
import { ConversationList } from '@/components/messaging/ConversationList'

export const metadata: Metadata = { title: 'Messages | The BLACQList' }

export default async function CustomerMessagesPage() {
  if (!isFeatureEnabled('messaging')) notFound()

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/sign-in?next=${encodeURIComponent(CUSTOMER_INBOX_PATH)}`)

  const [{ items, error }, owned] = await Promise.all([
    listCustomerConversations(supabase, user.id),
    supabase
      .from('listings')
      .select('id', { count: 'exact', head: true })
      .eq('owner_user_id', user.id)
      .is('deleted_at', null),
  ])
  const isOwner = (owned.count ?? 0) > 0

  return (
    <main>
      <div className="max-w-[960px] mx-auto">
        <h1 className="font-headline text-3xl text-brand-black mb-2">Messages</h1>
        <p className="font-body text-sm text-charcoal-soft mb-6">Your conversations with businesses.</p>
        {isOwner && (
          <p className="mb-4 rounded-xl bg-white border border-charcoal/10 px-4 py-3 font-body text-sm text-charcoal">
            Messages from customers to your business are in your{' '}
            <Link href={OWNER_INBOX_PATH} className="font-semibold text-brand-black underline underline-offset-2">
              business inbox
            </Link>
            .
          </p>
        )}
        {error ? (
          <p role="alert" className="rounded-xl bg-white border border-charcoal/10 px-4 py-3 font-body text-sm text-charcoal">
            We couldn&apos;t load your messages. Refresh to try again.
          </p>
        ) : (
          <ConversationList
            items={items}
            basePath={CUSTOMER_INBOX_PATH}
            emptyHeading="No messages yet"
            emptyBody="When a business has its inbox open, you'll see a Message button on its page. Your conversations show up here."
          />
        )}
      </div>
    </main>
  )
}
