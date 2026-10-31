import Link from 'next/link'
import type { Metadata } from 'next'

import { requireAdmin } from '@/lib/admin/guard'
import { createServiceClient } from '@/lib/supabase/server'
import {
  CITY_NOT_KNOWN,
  addListingHref,
  formatShortDate,
  groupKey,
  groupUnlistedReceipts,
} from '@/lib/spend/unlisted'
import { BusinessInviteForm } from './BusinessInviteForm'
import { MarkStopButton } from './MarkStopButton'
import { UnlistedLoadError } from './UnlistedLoadError'

export const metadata: Metadata = { title: 'Not on the list · Admin' }

/**
 * The newest unmatched receipts read for grouping. Far above today's volume;
 * the page says so if it is ever reached rather than quietly undercounting.
 */
const READ_CAP = 1000

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? 'https://theblacqlist.com'
}

/**
 * Businesses shoppers buy from that are not on The BLACQList yet (ticket 168).
 * Unmatched receipts grouped by business name: a count and the last date
 * seen, never who sent them or what they spent. From here the founder adds
 * the business as a listing or emails it one at a time (O2 B).
 */
export default async function AdminUnlistedBusinessesPage() {
  await requireAdmin()
  const serviceClient = createServiceClient()

  // Two columns only. The grouping can't leak a shopper because it never
  // receives one.
  const [receiptsRead, sendsRead] = await Promise.all([
    serviceClient
      .from('receipt_uploads')
      .select('raw_business_name, created_at')
      .is('listing_id', null)
      .order('created_at', { ascending: false })
      .limit(READ_CAP),
    serviceClient
      .from('business_invite_sends')
      .select('normalized_name, city, emailed_at, opted_out, opted_out_at'),
  ])

  const header = (
    <div className="space-y-3">
      <Link
        href="/admin/receipts"
        className="inline-flex items-center min-h-11 font-subhead text-sm text-charcoal-soft hover:text-brand-black"
      >
        Back to receipts
      </Link>
      <div>
        <h1 className="font-headline text-2xl text-brand-black">Not on the list</h1>
        <p className="font-subhead text-sm text-charcoal-soft mt-0.5">
          Businesses shoppers have added receipts from that aren&apos;t on The BLACQList yet.
        </p>
      </div>
    </div>
  )

  if (receiptsRead.error || sendsRead.error) {
    return (
      <div className="space-y-6">
        {header}
        <UnlistedLoadError />
      </div>
    )
  }

  const groups = groupUnlistedReceipts(receiptsRead.data ?? [])
  const sends = new Map((sendsRead.data ?? []).map((s) => [groupKey(s.normalized_name, s.city), s]))
  const capped = (receiptsRead.data?.length ?? 0) >= READ_CAP

  return (
    <div className="space-y-6">
      {header}

      {capped && (
        <p className="font-body text-xs text-charcoal-soft">
          Counted from the newest {READ_CAP.toLocaleString('en-US')} receipts that aren&apos;t
          matched to a listing.
        </p>
      )}

      {groups.length === 0 ? (
        <div className="rounded-xl border border-charcoal/10 bg-white px-6 py-12 text-center">
          <p className="font-subhead text-sm font-semibold text-brand-black">Nothing here yet</p>
          <p className="font-body text-xs text-charcoal-soft mt-1">
            Every receipt so far is matched to a business on The BLACQList.
          </p>
        </div>
      ) : (
        <ul className="rounded-xl border border-charcoal/10 bg-white divide-y divide-charcoal/5">
          {groups.map((group) => {
            const send = sends.get(group.key)
            const optedOut = send?.opted_out ?? false
            return (
              <li key={group.key} className="p-5 space-y-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 space-y-1">
                    <p className="font-subhead text-sm font-semibold text-brand-black break-words">
                      {group.displayName}
                    </p>
                    <p className="font-body text-xs text-charcoal-soft">
                      <span className="font-semibold text-brand-black tabular-nums">
                        {group.count} {group.count === 1 ? 'receipt' : 'receipts'}
                      </span>
                      {' · '}
                      Last seen{' '}
                      <time dateTime={group.lastSeen}>{formatShortDate(group.lastSeen)}</time>
                      {' · '}
                      {group.city ?? CITY_NOT_KNOWN}
                    </p>
                    {optedOut ? (
                      <p className="font-body text-xs font-semibold text-red-800">
                        Said STOP
                        {send?.opted_out_at ? ` on ${formatShortDate(send.opted_out_at)}` : ''}.
                        Email is off for this business.
                      </p>
                    ) : send?.emailed_at ? (
                      <p className="font-body text-xs text-charcoal-soft">
                        Emailed on {formatShortDate(send.emailed_at)}
                      </p>
                    ) : null}
                  </div>
                  <Link
                    href={addListingHref(group.displayName)}
                    className="inline-flex shrink-0 items-center justify-center h-11 px-5 w-full sm:w-auto rounded-full bg-amber-gold hover:bg-light-gold text-brand-black font-subhead font-bold text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-gold/60"
                  >
                    Add as a listing
                    <span className="sr-only">: {group.displayName}</span>
                  </Link>
                </div>

                <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
                  <BusinessInviteForm
                    businessName={group.displayName}
                    emailedAt={send?.emailed_at ?? null}
                    optedOut={optedOut}
                    siteUrl={siteUrl()}
                  />
                  {!optedOut && <MarkStopButton businessName={group.displayName} />}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
