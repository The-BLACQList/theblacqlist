import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requireOwner } from '@/lib/dashboard/guard'
import { documentLimit } from '@/lib/stripe/features'
import { DOCUMENT_COLUMNS, toOwnerDocuments } from '@/lib/listings/documents'
import { DocumentsManager } from '@/components/dashboard/DocumentsManager'

// Documents for one page (ticket 194): the menu, the rate card, the
// commission guide. Business pages only: a job or an event has no Offerings
// heading to carry them.

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ entityId: string }>
}

const NOTE =
  'rounded-xl border border-charcoal/10 bg-white px-5 py-4 font-body text-sm text-charcoal'

export default async function DocumentsPage({ params }: Props) {
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
      <h1 className="font-headline text-2xl text-brand-black">Documents</h1>
      <p className="font-body text-sm text-charcoal-soft mt-0.5">{listing.name}</p>
    </div>
  )

  if (listing.entity_type === 'job' || listing.entity_type === 'event') {
    return (
      <div className="max-w-2xl space-y-4">
        {heading}
        <p className={NOTE}>
          Documents are for business pages. A {listing.entity_type} page doesn&rsquo;t show them.
        </p>
      </div>
    )
  }

  const { data: rows, error } = await supabase
    .from('listing_documents')
    .select(DOCUMENT_COLUMNS)
    .eq('listing_id', listing.id)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  const limit = documentLimit(listing.tier)

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        {heading}
        <p className="font-body text-sm text-charcoal mt-3">
          Your menu, rate card or commission guide, as a PDF. Visitors download it from the button
          next to your Offerings heading.
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
        <DocumentsManager
          listingId={listing.id}
          initial={toOwnerDocuments(rows)}
          limit={limit}
          upgradeTo={
            listing.tier === 'premium'
              ? null
              : limit === 0
                ? 'Starter'
                : limit < 3
                  ? 'Growth'
                  : 'Premium'
          }
        />
      )}
    </div>
  )
}
