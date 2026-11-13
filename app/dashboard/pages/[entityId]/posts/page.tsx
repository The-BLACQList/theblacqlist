import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requireOwner } from '@/lib/dashboard/guard'
import { isFeatureEnabled } from '@/lib/env'
import { offerGrowthTo, offerPremiumTo } from '@/lib/marketplace/entitlements'
import { upgradeTarget } from '@/lib/stripe/planChecks'
import { toOwnerPosts } from '@/lib/listings/happeningNow'
import { PostsManager } from '@/components/dashboard/PostsManager'

// Happening now posts for one page (owner-experience round 2, part F).
// Business pages only: jobs and events are dated posts already.

interface Props {
  params: Promise<{ entityId: string }>
}

export default async function PostsPage({ params }: Props) {
  if (!isFeatureEnabled('happeningNow')) notFound()
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
  if (listing.entity_type === 'job' || listing.entity_type === 'event') {
    return (
      <div className="max-w-2xl space-y-4">
        <div>
          <h1 className="font-headline text-2xl text-brand-black">Happening now</h1>
          <p className="font-body text-sm text-charcoal-soft mt-0.5">{listing.name}</p>
        </div>
        <p className="rounded-xl border border-charcoal/10 bg-white px-5 py-4 font-body text-sm text-charcoal">
          Happening now posts are for business pages. A {listing.entity_type} already shows its own
          dates.
        </p>
      </div>
    )
  }

  const [{ data: rows }, growthOpen, premiumOpen] = await Promise.all([
    supabase
      .from('listing_posts')
      .select(
        'id, headline, body, image_path, button_label, button_url, starts_at, ends_at, status, created_at'
      )
      .eq('listing_id', listing.id)
      .order('created_at', { ascending: false }),
    offerGrowthTo(listing.tier),
    offerPremiumTo(listing.tier),
  ])

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="font-headline text-2xl text-brand-black">Happening now</h1>
        <p className="font-body text-sm text-charcoal-soft mt-0.5">{listing.name}</p>
        {listing.status !== 'published' && (
          <p className="mt-2 rounded-lg bg-pale-lavender px-3 py-2 font-body text-xs text-charcoal">
            Your page isn&rsquo;t published yet, so posts won&rsquo;t show until it is.{' '}
            <Link
              href={`/dashboard/pages/${listing.id}/edit`}
              className="font-semibold underline underline-offset-2"
            >
              Finish your page
            </Link>
          </p>
        )}
      </div>
      <PostsManager
        listingId={listing.id}
        initial={toOwnerPosts(rows)}
        tier={listing.tier}
        upgradeTo={upgradeTarget(listing.tier, growthOpen, premiumOpen)}
        initialNow={new Date().toISOString()}
      />
    </div>
  )
}
