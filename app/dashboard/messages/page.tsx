import type { Metadata } from 'next'
import type { Route } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Check, Settings, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { requireOwner } from '@/lib/dashboard/guard'
import { isFeatureEnabled } from '@/lib/env'
import { listInbox } from '@/lib/messaging/loaders'
import { isUuid, parseInboxTab, type InboxTab } from '@/lib/messaging/rules'
import { OWNER_INBOX_PATH } from '@/lib/messaging/constants'
import { ConversationList } from '@/components/messaging/ConversationList'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'Messages | Dashboard' }

interface Props {
  searchParams: Promise<{ listing?: string; tab?: string }>
}

const TAB_LABELS: Record<InboxTab, string> = {
  customers: 'Customers',
  jobs: 'Job applicants',
  events: 'Event guests',
  businesses: 'Businesses',
}

const EMPTY: Record<InboxTab, { heading: string; body: string }> = {
  customers: {
    heading: 'No messages from customers yet',
    body: 'When a customer messages you from your page, the conversation shows up here.',
  },
  jobs: {
    heading: 'No questions about your jobs yet',
    body: 'When someone asks about one of your job postings, the conversation shows up here.',
  },
  events: {
    heading: 'No questions about your events yet',
    body: 'When someone asks about one of your events, the conversation shows up here.',
  },
  businesses: {
    heading: 'No business messages yet',
    body: 'When you message a business from its page, or a business messages yours, the conversation shows up here.',
  },
}

function inboxHref(tab: InboxTab, listing: string | null): string {
  const params = new URLSearchParams()
  if (tab !== 'customers') params.set('tab', tab)
  if (listing) params.set('listing', listing)
  const query = params.toString()
  return query ? `${OWNER_INBOX_PATH}?${query}` : OWNER_INBOX_PATH
}

/**
 * The one inbox (owner-experience round 2, 2026-11-13). Customers: people
 * writing to my pages. Job applicants / Event guests: anyone asking about one
 * of my postings (part H; shown only with postings or threads there).
 * Businesses: pages writing to mine, and every thread I started with another
 * business, as me or as one of my pages.
 */
export default async function OwnerMessagesPage({ searchParams }: Props) {
  if (!isFeatureEnabled('messaging')) notFound()
  const owner = await requireOwner()
  const { listing, tab: rawTab } = await searchParams
  const tab = parseInboxTab(rawTab)
  const listingFilter = listing && isUuid(listing) ? listing : null

  const supabase = await createClient()
  const { items, pages, postings, tabs, unread, error } = await listInbox(supabase, owner.user.id, tab, listingFilter)

  const activeFilter = listingFilter && pages.some((p) => p.id === listingFilter) ? listingFilter : null
  const anyOpen = pages.some((p) => p.messagingEnabled)
  // A posting's own id (from its page's "View inbox") filters too; it has no chip.
  const postingFilter = listingFilter ? (postings.find((p) => p.id === listingFilter) ?? null) : null
  const empty = EMPTY[tab]

  return (
    <div className="max-w-3xl space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-headline text-2xl text-brand-black mb-1">Messages</h1>
          <p className="font-body text-sm text-charcoal-soft">
            Everything people and businesses send your pages and postings, and the businesses you write to.
          </p>
        </div>
        <Link
          href={`${OWNER_INBOX_PATH}/settings` as Route}
          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-charcoal/15 bg-white font-subhead text-xs font-semibold text-brand-black hover:bg-pale-lavender transition-colors"
        >
          <Settings className="size-3.5" aria-hidden="true" />
          Inbox settings
        </Link>
      </div>

      {pages.length > 0 && (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 font-body text-xs text-charcoal-soft">
          <span className="font-subhead font-semibold text-charcoal">Accepting new messages:</span>
          {pages.map((p) => (
            <span key={p.id} className="inline-flex items-center gap-1">
              {p.messagingEnabled ? (
                <Check className="size-3.5 text-green-700" aria-hidden="true" />
              ) : (
                <X className="size-3.5 text-charcoal-soft" aria-hidden="true" />
              )}
              {p.name}
              <span className="sr-only">{p.messagingEnabled ? ' (on)' : ' (off)'}</span>
            </span>
          ))}
        </p>
      )}

      <nav aria-label="Inbox" className="flex gap-1 border-b border-charcoal/10">
        {tabs.map((t) => {
          const active = t === tab
          const count = unread[t]
          return (
            <Link
              key={t}
              href={inboxHref(t, activeFilter) as Route}
              aria-current={active ? 'page' : undefined}
              className={cn(
                '-mb-px inline-flex items-center gap-2 px-3 py-2 border-b-2 font-subhead text-sm font-semibold transition-colors',
                active
                  ? 'border-brand-black text-brand-black'
                  : 'border-transparent text-charcoal-soft hover:text-brand-black'
              )}
            >
              {TAB_LABELS[t]}
              {count > 0 && (
                <span className="inline-flex min-w-5 h-5 items-center justify-center rounded-full bg-amber-gold px-1.5 font-subhead text-[11px] font-bold text-brand-black">
                  {count > 99 ? '99+' : count}
                  <span className="sr-only"> unread</span>
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {postingFilter && (
        <p className="flex flex-wrap items-center gap-2 font-body text-sm text-charcoal-soft">
          Showing messages about <span className="font-semibold text-brand-black">{postingFilter.name}</span>
          <Link href={inboxHref(tab, null) as Route} className="underline underline-offset-2 hover:text-brand-black">
            Show all
          </Link>
        </p>
      )}

      {pages.length > 1 && (
        <nav aria-label="Filter by page" className="flex flex-wrap gap-2">
          <FilterChip href={inboxHref(tab, null)} active={!activeFilter} label="All pages" />
          {pages.map((p) => (
            <FilterChip key={p.id} href={inboxHref(tab, p.id)} active={activeFilter === p.id} label={p.name} />
          ))}
        </nav>
      )}

      {error ? (
        <p role="alert" className="rounded-xl bg-white border border-charcoal/10 px-4 py-3 font-body text-sm text-charcoal">
          We couldn&apos;t load your messages. Refresh to try again.
        </p>
      ) : (
        <ConversationList
          items={items}
          basePath={OWNER_INBOX_PATH}
          emptyHeading={empty.heading}
          emptyBody={
            tab === 'customers' && !anyOpen
              ? 'Your inbox is off. Turn it on in Inbox settings so customers can message you.'
              : empty.body
          }
        />
      )}
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
