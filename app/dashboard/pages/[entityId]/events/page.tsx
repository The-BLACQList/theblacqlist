import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { CalendarDays, ExternalLink, Lock, Plus } from 'lucide-react'

import { createClient } from '@/lib/supabase/server'
import { requireOwner } from '@/lib/dashboard/guard'
import { isFeatureEnabled } from '@/lib/env'
import { canAccess, eventLimit } from '@/lib/stripe/features'
import { eventQuotaFor } from '@/lib/stripe/jobPostings'
import { getPlanAvailability, isPlanPurchasable } from '@/lib/stripe/availability'
import { buildEntityUrl } from '@/lib/listings/url'
import { isEventOver } from '@/lib/events/eventOver'
import {
  eventAllowanceLine,
  ownerEventStatusLabel,
  splitOwnerEvents,
  type OwnerEventRow,
} from '@/lib/events/ownerEvents'
import { EventUnpublishButton } from '@/components/dashboard/EventUnpublishButton'

export const metadata: Metadata = { title: 'Events | Dashboard' }

// Flags are read per request (see lib/env.ts), so this must not prerender.
export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ entityId: string }>
}

// Ticket 106. A business page's Events tab: the events this page hosts, with
// New, Edit, View and Unpublish. Creating reuses /add-event's form and actions;
// editing is the event's own editor. Every limit shown here is checked again
// in createListing and submitListingForReview.
export default async function PageEventsPage({ params }: Props) {
  const { entityId } = await params
  const owner = await requireOwner()
  const supabase = await createClient()

  const { data: listing } = await supabase
    .from('listings')
    .select('id, name, entity_type')
    .eq('id', entityId)
    .eq('owner_user_id', owner.user.id)
    .is('deleted_at', null)
    .maybeSingle()

  if (!listing) notFound()
  // An event or a job cannot host events; its own editor is the right place.
  if (listing.entity_type === 'event' || listing.entity_type === 'job') {
    redirect(`/dashboard/pages/${listing.id}/edit`)
  }

  const paidPostings = isFeatureEnabled('paidPostings')
  const submissionsOpen = isFeatureEnabled('postingSubmissions')

  const [quota, availability, detailsRead] = await Promise.all([
    paidPostings ? eventQuotaFor(supabase, owner.user.id) : Promise.resolve(null),
    getPlanAvailability(supabase),
    supabase
      .from('listing_details_event')
      .select('listing_id, starts_at, ends_at')
      .eq('organizer_listing_id', listing.id)
      .limit(200),
  ])

  // Other owners' published events can name this page as host, and the read
  // policy lets anyone see published rows. Only this owner's events belong here.
  const details = detailsRead.data ?? []
  let eventsError = !!detailsRead.error
  let rows: OwnerEventRow[] = []
  if (!eventsError && details.length > 0) {
    const { data: events, error } = await supabase
      .from('listings')
      .select('id, name, slug, status, entity_type, cities(slug)')
      .in(
        'id',
        details.map((d) => d.listing_id)
      )
      .eq('owner_user_id', owner.user.id)
      .eq('entity_type', 'event')
      .is('deleted_at', null)
    eventsError = !!error
    const timeById = new Map(details.map((d) => [d.listing_id, d]))
    rows = (events ?? []).map((e) => {
      const t = timeById.get(e.id)
      return {
        id: e.id,
        name: e.name,
        status: e.status,
        startsAt: t?.starts_at ?? null,
        endsAt: t?.ends_at ?? null,
        publicUrl: buildEntityUrl(
          e.entity_type,
          (e.cities as { slug: string } | null)?.slug,
          e.slug
        ),
      }
    })
  }

  const { upcoming, past } = splitOwnerEvents(rows)

  // Gate state. With paid postings off nothing is gated, matching the actions.
  const planHasEvents =
    !paidPostings || (quota?.ok === true && canAccess(quota.value.tier, 'events'))
  const quotaFailed = paidPostings && quota?.ok === false
  const atLimit = quota?.ok === true && quota.value.atLimit
  const canStart = submissionsOpen && planHasEvents && !quotaFailed
  const growthForSale =
    isPlanPurchasable(availability, 'growth', 'monthly') ||
    isPlanPurchasable(availability, 'growth', 'annual')

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-headline text-2xl text-brand-black">Events</h1>
          <p className="font-body text-sm text-charcoal-soft mt-0.5">{listing.name}</p>
          {quota?.ok === true && planHasEvents && (
            <p className="font-body text-xs text-charcoal-soft mt-1">
              {eventAllowanceLine(quota.value.limit, quota.value.used)}
            </p>
          )}
        </div>
        {canStart && (
          <Link
            href={`/dashboard/pages/${listing.id}/events/new`}
            className="inline-flex items-center gap-1.5 h-10 min-h-[44px] px-4 rounded-full bg-amber-gold text-brand-black font-subhead font-bold text-sm hover:bg-light-gold transition-colors"
          >
            <Plus className="size-4" aria-hidden="true" />
            New event
          </Link>
        )}
      </div>

      {paidPostings && !quotaFailed && !planHasEvents && (
        <div className="flex items-start gap-3 rounded-lg border border-charcoal/10 bg-pale-lavender px-4 py-3">
          <Lock className="size-4 text-charcoal-soft mt-0.5 shrink-0" aria-hidden="true" />
          <div className="flex-1 min-w-0">
            <p className="font-body text-sm text-charcoal">
              Events come with the Growth plan. Post up to {eventLimit('growth')} at a time, and
              each one shows on this page and on Events.
              {!growthForSale && ' Growth is not for sale yet.'}
            </p>
            {growthForSale && (
              <Link
                href="/dashboard/upgrade"
                className="inline-flex items-center mt-2 font-subhead font-bold text-sm text-brand-black underline underline-offset-4 decoration-amber-gold hover:decoration-brand-black"
              >
                See the Growth plan
              </Link>
            )}
          </div>
        </div>
      )}

      {quotaFailed && (
        <p role="alert" className="font-body text-sm text-red-700">
          We could not check your event allowance right now. Refresh the page to try again.
        </p>
      )}

      {atLimit && planHasEvents && (
        <p className="font-body text-sm text-charcoal">
          You are at your plan&apos;s limit. You can still start a draft; unpublish an event to send
          a new one for review.
        </p>
      )}

      {eventsError ? (
        <div
          role="alert"
          className="rounded-xl border border-charcoal/10 bg-white px-6 py-10 text-center"
        >
          <h2 className="font-headline text-lg text-brand-black">Couldn&apos;t load your events</h2>
          <p className="font-body text-sm text-charcoal-soft mt-2">Something went wrong.</p>
          <Link
            href={`/dashboard/pages/${listing.id}/events`}
            className="inline-flex items-center h-10 min-h-[44px] px-5 mt-4 rounded-full bg-brand-black text-white font-subhead font-bold text-sm hover:bg-charcoal transition-colors"
          >
            Try again
          </Link>
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-charcoal/10 bg-white px-6 py-10 text-center">
          <CalendarDays className="size-10 text-charcoal/20 mx-auto mb-3" aria-hidden="true" />
          <h2 className="font-headline text-lg text-brand-black">No events yet</h2>
          <p className="font-body text-sm text-charcoal-soft mt-2 max-w-sm mx-auto">
            Events you start here show on this page once they are live, and leave the site on their
            own after they end.
          </p>
        </div>
      ) : (
        <>
          <section aria-labelledby="upcoming-events" className="space-y-3">
            <h2 id="upcoming-events" className="font-headline text-base text-brand-black">
              Upcoming
            </h2>
            {upcoming.length === 0 ? (
              <p className="font-body text-sm text-charcoal-soft">No upcoming events.</p>
            ) : (
              <EventList rows={upcoming} />
            )}
          </section>

          {past.length > 0 && (
            <details className="rounded-xl border border-charcoal/10 bg-white">
              <summary className="cursor-pointer px-5 py-3 min-h-[44px] font-subhead text-sm font-semibold text-brand-black">
                Past events ({past.length})
              </summary>
              <div className="px-3 pb-3">
                <EventList rows={past} past />
              </div>
            </details>
          )}
        </>
      )}
    </div>
  )
}

function formatWhen(iso: string | null): string {
  if (!iso) return 'Date not set'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return 'Date not set'
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function EventList({ rows, past = false }: { rows: OwnerEventRow[]; past?: boolean }) {
  return (
    <ul className="space-y-3">
      {rows.map((e) => {
        const over = past || isEventOver(e.startsAt, e.endsAt)
        const label = ownerEventStatusLabel(e.status, over)
        return (
          <li key={e.id} className="rounded-xl border border-charcoal/10 bg-white">
            <div className="px-5 py-4 flex items-center gap-4 flex-wrap">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-headline text-base text-brand-black">{e.name}</p>
                  <span
                    className={`px-2 py-0.5 rounded-full font-subhead text-xs font-semibold ${
                      e.status === 'published'
                        ? 'bg-green-100 text-green-700'
                        : e.status === 'pending'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-charcoal/10 text-charcoal-soft'
                    }`}
                  >
                    {label}
                  </span>
                </div>
                <p className="font-body text-xs text-charcoal-soft mt-0.5">
                  {formatWhen(e.startsAt)}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {e.status === 'published' && (
                  <Link
                    href={e.publicUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`View ${e.name}`}
                    className="inline-flex items-center justify-center size-8 min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0 rounded-lg text-charcoal-faint hover:text-charcoal hover:bg-charcoal/5 transition-colors"
                  >
                    <ExternalLink className="size-4" aria-hidden="true" />
                  </Link>
                )}
                {e.status === 'published' && !over && (
                  <EventUnpublishButton eventId={e.id} eventName={e.name} />
                )}
                <Link
                  href={`/dashboard/pages/${e.id}/edit`}
                  aria-label={`Edit ${e.name}`}
                  className="inline-flex items-center h-8 min-h-[44px] md:min-h-0 px-3 rounded-lg bg-amber-gold text-brand-black font-subhead font-bold text-xs hover:bg-light-gold transition-colors"
                >
                  Edit
                </Link>
              </div>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
