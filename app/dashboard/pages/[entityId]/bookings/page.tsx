import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requireOwner } from '@/lib/dashboard/guard'
import { isFeatureEnabled } from '@/lib/env'
import { canAccess } from '@/lib/stripe/features'
import { premiumIsOpen } from '@/lib/marketplace/entitlements'
import {
  BOOKING_INBOX_MAX,
  BOOKING_REQUEST_COLUMNS,
  toBookingSettings,
  toOwnerBookings,
} from '@/lib/listings/booking'
import { BookingsManager } from '@/components/dashboard/BookingsManager'
import { PlanLimitNote } from '@/components/dashboard/PlanLimitNote'

// Booking requests for one page (ticket 109): the form's settings and the
// requests that came in. Business pages only. The flag closes the whole page;
// a page below Premium can't switch the form on but still sees and answers
// requests it already has.

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ entityId: string }>
}

function Heading({ name }: { name: string }) {
  return (
    <div>
      <h1 className="font-headline text-2xl text-brand-black">Bookings</h1>
      <p className="font-body text-sm text-charcoal-soft mt-0.5">{name}</p>
    </div>
  )
}

const NOTE =
  'rounded-xl border border-charcoal/10 bg-white px-5 py-4 font-body text-sm text-charcoal'

export default async function BookingsPage({ params }: Props) {
  const { entityId } = await params
  const owner = await requireOwner()
  const supabase = await createClient()

  const { data: listing } = await supabase
    .from('listings')
    .select('id, name, entity_type, tier, status')
    .eq('id', entityId)
    .eq('owner_user_id', owner.user.id)
    .is('deleted_at', null)
    .maybeSingle()
  if (!listing) notFound()

  if (!isFeatureEnabled('bookingRequests')) {
    return (
      <div className="max-w-2xl space-y-4">
        <Heading name={listing.name} />
        <p className={NOTE}>Booking requests aren&rsquo;t open yet. We&rsquo;ll let you know.</p>
      </div>
    )
  }
  if (listing.entity_type === 'job' || listing.entity_type === 'event') {
    return (
      <div className="max-w-2xl space-y-4">
        <Heading name={listing.name} />
        <p className={NOTE}>
          Booking requests are for business pages. A {listing.entity_type} page doesn&rsquo;t take
          them.
        </p>
      </div>
    )
  }

  const premium = canAccess(listing.tier, 'booking_requests')
  const [settingsRead, requestsRead, servicesRead, premiumOpen] = await Promise.all([
    supabase
      .from('listing_booking_settings')
      .select('enabled, prompt, ask_date, ask_party_size')
      .eq('listing_id', listing.id)
      .maybeSingle(),
    supabase
      .from('booking_requests')
      .select(BOOKING_REQUEST_COLUMNS)
      .eq('listing_id', listing.id)
      .order('created_at', { ascending: false })
      .limit(BOOKING_INBOX_MAX),
    supabase.from('services').select('id, name').eq('listing_id', listing.id),
    premium ? Promise.resolve(false) : premiumIsOpen(),
  ])

  const serviceNames: Record<string, string> = {}
  for (const s of servicesRead.data ?? []) serviceNames[s.id] = s.name

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Heading name={listing.name} />
        {listing.status !== 'published' && (
          <p className="mt-2 rounded-lg bg-pale-lavender px-3 py-2 font-body text-xs text-charcoal">
            Your page isn&rsquo;t published yet, so the form won&rsquo;t show until it is.{' '}
            <Link
              href={`/dashboard/pages/${listing.id}/edit`}
              className="font-semibold underline underline-offset-2"
            >
              Finish your page
            </Link>
          </p>
        )}
      </div>
      {!premium && (
        <PlanLimitNote upgradeTo={premiumOpen ? 'Premium' : null}>
          Booking requests come with Premium. Requests you already have stay here, and you can still
          answer them.
        </PlanLimitNote>
      )}
      {settingsRead.error || requestsRead.error ? (
        <p className={NOTE}>
          We couldn&rsquo;t load your bookings right now. Please try again in a moment.
        </p>
      ) : (
        <BookingsManager
          listingId={listing.id}
          canEnable={premium}
          initialSettings={toBookingSettings(settingsRead.data)}
          initialRequests={toOwnerBookings(requestsRead.data)}
          serviceNames={serviceNames}
        />
      )}
    </div>
  )
}
