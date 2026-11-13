import type { Metadata } from 'next'
import type { Route } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { requireOwner } from '@/lib/dashboard/guard'
import { isFeatureEnabled } from '@/lib/env'
import { listBlockedCustomers, listSavedReplies, loadInboxSettings } from '@/lib/messaging/loaders'
import { OWNER_INBOX_PATH } from '@/lib/messaging/constants'
import { InboxSwitch } from '@/components/dashboard/InboxSwitch'
import { BlockButton } from '@/components/messaging/BlockButton'
import { SavedRepliesManager } from '@/components/messaging/SavedRepliesManager'

export const metadata: Metadata = { title: 'Inbox settings | Dashboard' }

/**
 * Inbox settings (owner-experience round 2): one switch per page, job and
 * event postings (part H: a posting linked to one of your pages follows that
 * page's switch; an unlinked one has its own), saved replies, and the people
 * blocked from messaging any of them. The edit page's main-button section
 * shows the same switch for that one page.
 */
export default async function InboxSettingsPage() {
  if (!isFeatureEnabled('messaging')) notFound()
  const owner = await requireOwner()
  const supabase = await createClient()

  const [settings, blocked, saved] = await Promise.all([
    loadInboxSettings(supabase, owner.user.id),
    listBlockedCustomers(supabase, owner.user.id),
    listSavedReplies(supabase, owner.user.id),
  ])
  const pages = settings?.pages ?? []
  const postings = settings?.postings ?? []

  return (
    <div className="max-w-3xl space-y-6">
      <Link
        href={OWNER_INBOX_PATH as Route}
        className="inline-flex items-center gap-1.5 font-subhead text-sm font-semibold text-charcoal-soft hover:text-brand-black"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Messages
      </Link>

      <div>
        <h1 className="font-headline text-2xl text-brand-black mb-1">Inbox settings</h1>
        <p className="font-body text-sm text-charcoal-soft">
          Choose which pages and postings take new messages, and keep replies you send often.
        </p>
      </div>

      <section aria-labelledby="pages-heading" className="rounded-2xl bg-white border border-charcoal/10">
        <h2 id="pages-heading" className="px-4 pt-4 font-subhead text-sm font-bold text-brand-black">
          Your pages
        </h2>
        {!settings ? (
          <p role="alert" className="px-4 py-3 font-body text-sm text-charcoal">
            We couldn&apos;t load your pages. Refresh to try again.
          </p>
        ) : (
          <ul className="divide-y divide-charcoal/8">
            {pages.map((p) => (
              <li key={p.id} className="px-4 pt-4 pb-2">
                <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2">
                  <span className="font-subhead text-sm font-semibold text-brand-black">{p.name}</span>
                  {!p.published && (
                    <span className="font-body text-xs text-charcoal-soft">Not live yet: takes messages once published</span>
                  )}
                </div>
                <InboxSwitch
                  listingId={p.id}
                  initialOpen={p.messagingEnabled}
                  label={`Let customers message ${p.name}`}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {postings.length > 0 && (
        <section aria-labelledby="postings-heading" className="rounded-2xl bg-white border border-charcoal/10">
          <div className="px-4 pt-4">
            <h2 id="postings-heading" className="font-subhead text-sm font-bold text-brand-black">
              Job and event postings
            </h2>
            <p className="font-body text-xs text-charcoal-soft mt-0.5">
              A posting linked to one of your pages takes messages when that page does. Jobs stop taking new messages
              once they close, and events once they&apos;re over.
            </p>
          </div>
          <ul className="divide-y divide-charcoal/8">
            {postings.map((p) => (
              <li key={p.id} className="px-4 pt-4 pb-2">
                <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2">
                  <span className="font-subhead text-sm font-semibold text-brand-black">
                    <span className="font-normal text-charcoal-soft">{p.kind === 'job' ? 'Job · ' : 'Event · '}</span>
                    {p.name}
                  </span>
                  {!p.published && (
                    <span className="font-body text-xs text-charcoal-soft">Not live: takes messages once published</span>
                  )}
                </div>
                {p.linkedPageId ? (
                  <p className="pb-2 font-body text-sm text-charcoal">
                    Follows {p.linkedPageName ?? 'your page'}&apos;s inbox.{' '}
                    <span className="text-charcoal-soft">
                      {pages.find((pg) => pg.id === p.linkedPageId)?.messagingEnabled ? 'Open' : 'Closed'} right now.
                    </span>
                  </p>
                ) : (
                  <InboxSwitch
                    listingId={p.id}
                    initialOpen={p.messagingEnabled}
                    label={`Let people message about ${p.name}`}
                    hint={
                      p.kind === 'job'
                        ? 'When on, job seekers can ask about this role from the posting. Turning it off stops new conversations; you can still reply to existing ones.'
                        : 'When on, people can ask about this event from the posting. Turning it off stops new conversations; you can still reply to existing ones.'
                    }
                  />
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="saved-heading" className="rounded-2xl bg-white border border-charcoal/10 px-4 py-4">
        <h2 id="saved-heading" className="font-subhead text-sm font-bold text-brand-black">
          Saved replies
        </h2>
        <p className="font-body text-xs text-charcoal-soft mt-0.5 mb-3">
          Offered as quick replies when you answer a message. Picking one fills the reply box for you to edit; it
          never sends by itself.
        </p>
        <SavedRepliesManager initial={saved} />
      </section>

      <section aria-labelledby="blocked-heading" className="rounded-2xl bg-white border border-charcoal/10 px-4 py-4">
        <h2 id="blocked-heading" className="font-subhead text-sm font-bold text-brand-black">
          Blocked
        </h2>
        <p className="font-body text-xs text-charcoal-soft mt-0.5 mb-3">
          People you block can&apos;t message any of your pages, as themselves or as a business. They aren&apos;t told.
        </p>
        {blocked.length === 0 ? (
          <p className="font-body text-sm text-charcoal-soft">You haven&apos;t blocked anyone.</p>
        ) : (
          <ul className="divide-y divide-charcoal/8">
            {blocked.map((b) => (
              <li key={b.userId} className="flex items-center justify-between gap-3 py-2.5">
                <span className="font-body text-sm text-brand-black truncate">{b.displayName}</span>
                <BlockButton customerUserId={b.userId} blocked variant="link" />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
