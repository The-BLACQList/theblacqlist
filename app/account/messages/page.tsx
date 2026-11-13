import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isFeatureEnabled } from '@/lib/env'
import { listInbox, ownsAnyPage } from '@/lib/messaging/loaders'
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

  // One inbox: a page owner's conversations with businesses are in the
  // dashboard inbox's Businesses tab, next to their customers.
  if (await ownsAnyPage(supabase, user.id)) redirect(`${OWNER_INBOX_PATH}?tab=businesses`)

  const { items, error } = await listInbox(supabase, user.id, 'businesses', null)

  return (
    <main>
      <div className="max-w-[960px] mx-auto">
        <h1 className="font-headline text-3xl text-brand-black mb-2">Messages</h1>
        <p className="font-body text-sm text-charcoal-soft mb-6">Your conversations with businesses.</p>
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
