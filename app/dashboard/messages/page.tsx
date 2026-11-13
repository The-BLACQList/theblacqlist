import type { Metadata } from 'next'
import type { Route } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireOwner } from '@/lib/dashboard/guard'
import { isFeatureEnabled } from '@/lib/env'
import { listBlockedCustomers, listOwnerConversations } from '@/lib/messaging/loaders'
import { isUuid } from '@/lib/messaging/rules'
import { OWNER_INBOX_PATH } from '@/lib/messaging/constants'
import { ConversationList } from '@/components/messaging/ConversationList'
import { BlockButton } from '@/components/messaging/BlockButton'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'Messages | Dashboard' }

interface Props {
  searchParams: Promise<{ listing?: string }>
}

export default async function OwnerMessagesPage({ searchParams }: Props) {
  if (!isFeatureEnabled('messaging')) notFound()
  const owner = await requireOwner()
  const { listing } = await searchParams
  const listingFilter = listing && isUuid(listing) ? listing : null

  const supabase = await createClient()
  const [{ items, listings, error }, blocked] = await Promise.all([
    listOwnerConversations(supabase, owner.user.id, listingFilter),
    listBlockedCustomers(supabase, owner.user.id),
  ])

  const activeFilter = listingFilter && listings.some((l) => l.id === listingFilter) ? listingFilter : null
  const shown = activeFilter ? listings.filter((l) => l.id === activeFilter) : listings
  const anyOpen = listings.some((l) => l.messagingEnabled)

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="font-headline text-2xl text-brand-black mb-1">Messages</h1>
        <p className="font-body text-sm text-charcoal-soft">Conversations customers started from your pages.</p>
      </div>

      {listings.length > 1 && (
        <nav aria-label="Filter by page" className="flex flex-wrap gap-2">
          <FilterChip href={OWNER_INBOX_PATH} active={!activeFilter} label="All pages" />
          {listings.map((l) => (
            <FilterChip
              key={l.id}
              href={`${OWNER_INBOX_PATH}?listing=${l.id}`}
              active={activeFilter === l.id}
              label={l.name}
            />
          ))}
        </nav>
      )}

      {listings.length > 0 && (
        <ul className="rounded-2xl bg-white border border-charcoal/10 divide-y divide-charcoal/8">
          {shown.map((l) => (
            <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
              <span className="font-subhead text-sm font-semibold text-brand-black">{l.name}</span>
              <span className="flex items-center gap-3">
                <span
                  className={cn(
                    'inline-flex items-center rounded-full px-2.5 py-0.5 font-subhead text-xs font-semibold',
                    l.messagingEnabled ? 'bg-green-100 text-green-800' : 'bg-charcoal/8 text-charcoal-soft'
                  )}
                >
                  {l.messagingEnabled ? 'Inbox open' : 'Inbox closed'}
                </span>
                <Link
                  href={`/dashboard/pages/${l.id}/edit` as Route}
                  className="font-subhead text-xs font-semibold text-brand-black underline underline-offset-2 hover:text-charcoal"
                >
                  {l.messagingEnabled ? 'Change' : 'Open inbox'}
                </Link>
              </span>
            </li>
          ))}
        </ul>
      )}

      {error ? (
        <p role="alert" className="rounded-xl bg-white border border-charcoal/10 px-4 py-3 font-body text-sm text-charcoal">
          We couldn&apos;t load your messages. Refresh to try again.
        </p>
      ) : (
        <ConversationList
          items={items}
          basePath={OWNER_INBOX_PATH}
          emptyHeading="No messages yet"
          emptyBody={
            anyOpen
              ? 'When a customer messages you from your page, the conversation shows up here.'
              : 'Your inbox is closed. Open it from Edit page so customers can message you.'
          }
        />
      )}

      <section aria-labelledby="blocked-heading" className="rounded-2xl bg-white border border-charcoal/10 px-4 py-4">
        <h2 id="blocked-heading" className="font-subhead text-sm font-bold text-brand-black">
          Blocked customers
        </h2>
        <p className="font-body text-xs text-charcoal-soft mt-0.5 mb-3">
          Blocked customers can&apos;t message any of your pages. They aren&apos;t told.
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

function FilterChip({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href as Route}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'inline-flex items-center h-8 px-3 rounded-full border font-subhead text-xs font-semibold transition-colors',
        active
          ? 'bg-brand-black text-white border-brand-black'
          : 'bg-white text-brand-black border-charcoal/15 hover:bg-pale-lavender'
      )}
    >
      {label}
    </Link>
  )
}
