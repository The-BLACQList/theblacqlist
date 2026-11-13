import type { Metadata } from 'next'
import type { Route } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { requireOwner } from '@/lib/dashboard/guard'
import { isFeatureEnabled } from '@/lib/env'
import { listBlockedCustomers } from '@/lib/messaging/loaders'
import { OWNER_INBOX_PATH } from '@/lib/messaging/constants'
import { InboxSwitch } from '@/components/dashboard/InboxSwitch'
import { BlockButton } from '@/components/messaging/BlockButton'

export const metadata: Metadata = { title: 'Inbox settings | Dashboard' }

/**
 * Inbox settings (owner-experience round 2): one switch per page, and the
 * people blocked from messaging any of them. The edit page's main-button
 * section shows the same switch for that one page.
 */
export default async function InboxSettingsPage() {
  if (!isFeatureEnabled('messaging')) notFound()
  const owner = await requireOwner()
  const supabase = await createClient()

  const [{ data: pages, error }, blocked] = await Promise.all([
    supabase
      .from('listings')
      .select('id, name, status, messaging_enabled')
      .eq('owner_user_id', owner.user.id)
      .is('deleted_at', null)
      .order('name'),
    listBlockedCustomers(supabase, owner.user.id),
  ])

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
        <p className="font-body text-sm text-charcoal-soft">Choose which pages take new messages.</p>
      </div>

      <section aria-labelledby="pages-heading" className="rounded-2xl bg-white border border-charcoal/10">
        <h2 id="pages-heading" className="px-4 pt-4 font-subhead text-sm font-bold text-brand-black">
          Your pages
        </h2>
        {error ? (
          <p role="alert" className="px-4 py-3 font-body text-sm text-charcoal">
            We couldn&apos;t load your pages. Refresh to try again.
          </p>
        ) : (
          <ul className="divide-y divide-charcoal/8">
            {(pages ?? []).map((p) => (
              <li key={p.id} className="px-4 pt-4 pb-2">
                <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2">
                  <span className="font-subhead text-sm font-semibold text-brand-black">{p.name}</span>
                  {p.status !== 'published' && (
                    <span className="font-body text-xs text-charcoal-soft">Not live yet: takes messages once published</span>
                  )}
                </div>
                <InboxSwitch
                  listingId={p.id}
                  initialOpen={p.messaging_enabled}
                  label={`Let customers message ${p.name}`}
                />
              </li>
            ))}
          </ul>
        )}
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
