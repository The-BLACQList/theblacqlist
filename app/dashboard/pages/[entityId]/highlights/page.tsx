import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requireOwner } from '@/lib/dashboard/guard'
import { highlightLimit } from '@/lib/stripe/features'
import { HIGHLIGHT_COLUMNS, toOwnerHighlights } from '@/lib/listings/highlights'
import { HighlightsManager } from '@/components/dashboard/HighlightsManager'

// Highlights and process steps for one page (ticket 195). Business pages
// only: a job or an event has no highlights block.

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ entityId: string }>
}

const NOTE =
  'rounded-xl border border-charcoal/10 bg-white px-5 py-4 font-body text-sm text-charcoal'

export default async function HighlightsPage({ params }: Props) {
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

  const heading = (
    <div>
      <h1 className="font-headline text-2xl text-brand-black">Highlights</h1>
      <p className="font-body text-sm text-charcoal-soft mt-0.5">{listing.name}</p>
    </div>
  )

  if (listing.entity_type === 'job' || listing.entity_type === 'event') {
    return (
      <div className="max-w-2xl space-y-4">
        {heading}
        <p className={NOTE}>
          Highlights are for business pages. A {listing.entity_type} page doesn&rsquo;t show them.
        </p>
      </div>
    )
  }

  const { data: rows, error } = await supabase
    .from('listing_highlights')
    .select(HIGHLIGHT_COLUMNS)
    .eq('listing_id', listing.id)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  const limit = highlightLimit(listing.tier)

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        {heading}
        <p className="font-body text-sm text-charcoal mt-3">
          A few icon bullets on why to choose you, or the steps of working with you. Your page shows
          them in the order you set here.
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
        <HighlightsManager
          listingId={listing.id}
          initial={toOwnerHighlights(rows)}
          limit={limit}
          upgradeTo={limit === 0 ? 'Starter' : limit < 6 ? 'Growth' : null}
        />
      )}
    </div>
  )
}
