import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requireOwner } from '@/lib/dashboard/guard'
import {
  HOURS_OVERRIDE_COLUMNS,
  futureDateKey,
  toHoursOverrides,
} from '@/lib/listings/hoursOverrides'
import { HoursOverridesManager } from '@/components/dashboard/HoursOverridesManager'

// Holiday and special hours for one page (ticket 196). All plans; business
// pages only, since a job or an event has no weekly hours.

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ entityId: string }>
}

const NOTE =
  'rounded-xl border border-charcoal/10 bg-white px-5 py-4 font-body text-sm text-charcoal'

export default async function SpecialHoursPage({ params }: Props) {
  const { entityId } = await params
  const owner = await requireOwner()
  const supabase = await createClient()

  const { data: listing } = await supabase
    .from('listings')
    .select('id, name, entity_type, status')
    .eq('id', entityId)
    .eq('owner_user_id', owner.user.id)
    .is('deleted_at', null)
    .maybeSingle()
  if (!listing) notFound()

  const heading = (
    <div>
      <h1 className="font-headline text-2xl text-brand-black">Special Hours</h1>
      <p className="font-body text-sm text-charcoal-soft mt-0.5">{listing.name}</p>
    </div>
  )

  if (listing.entity_type === 'job' || listing.entity_type === 'event') {
    return (
      <div className="max-w-2xl space-y-4">
        {heading}
        <p className={NOTE}>
          Special hours are for business pages. A {listing.entity_type} page doesn&rsquo;t have
          weekly hours.
        </p>
      </div>
    )
  }

  const { data: rows, error } = await supabase
    .from('listing_hours_overrides')
    .select(HOURS_OVERRIDE_COLUMNS)
    .eq('listing_id', listing.id)
    .gte('date', futureDateKey(new Date(), -1))
    .order('date', { ascending: true })

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        {heading}
        <p className="font-body text-sm text-charcoal mt-3">
          Holidays and one-off days. A date set here replaces that day&rsquo;s{' '}
          <Link
            href={`/dashboard/pages/${listing.id}/edit#hours`}
            className="font-semibold underline underline-offset-2"
          >
            weekly hours
          </Link>
          , and your page lists the next 30 days of them.
        </p>
        {listing.status !== 'published' && (
          <p className="mt-2 rounded-lg bg-pale-lavender px-3 py-2 font-body text-xs text-charcoal">
            Your page isn&rsquo;t published yet, so these won&rsquo;t show until it is.{' '}
            <Link
              href={`/dashboard/pages/${listing.id}/edit`}
              className="font-semibold underline underline-offset-2"
            >
              Finish your page
            </Link>
          </p>
        )}
      </div>
      {error ? (
        <p className={NOTE}>
          We couldn&rsquo;t load these right now. Please try again in a moment.
        </p>
      ) : (
        <HoursOverridesManager listingId={listing.id} initial={toHoursOverrides(rows)} />
      )}
    </div>
  )
}
