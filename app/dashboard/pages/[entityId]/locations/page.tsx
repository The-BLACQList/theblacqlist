import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requireOwner } from '@/lib/dashboard/guard'
import { locationLimit } from '@/lib/stripe/features'
import { premiumIsOpen } from '@/lib/marketplace/entitlements'
import {
  LOCATION_LINK_COLUMNS,
  coversLocations,
  linkedSlots,
  toLocationLinkRows,
} from '@/lib/listings/locations'
import {
  LocationsManager,
  type LinkCandidate,
  type OwnerLocation,
} from '@/components/dashboard/LocationsManager'
import { PlanLimitNote } from '@/components/dashboard/PlanLimitNote'
import { highestTier } from '@/lib/services/billing/ownerPlan'
import { UnlinkSelfButton } from '@/components/dashboard/UnlinkSelfButton'

// Multi-location accounts (ticket 110). On the main page of a group: its
// linked locations, linking another, and numbers per location and in total.
// On a linked location: which page it is linked to, and a way out. Since
// ticket 238 links are display only (Also At); the plan is the owner's.

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ entityId: string }>
}

interface PageRow {
  id: string
  name: string
  status: string | null
  entity_type: string
  tier: string | null
  view_count: number | null
  save_count: number | null
  review_count: number | null
  cities: { name: string } | null
}

const NOTE =
  'rounded-xl border border-charcoal/10 bg-white px-5 py-4 font-body text-sm text-charcoal'

function Heading({ name }: { name: string }) {
  return (
    <div>
      <h1 className="font-headline text-2xl text-brand-black">Locations</h1>
      <p className="font-body text-sm text-charcoal-soft mt-0.5">{name}</p>
    </div>
  )
}

function toOwnerLocation(p: PageRow): OwnerLocation {
  return {
    id: p.id,
    name: p.name,
    cityName: p.cities?.name ?? '',
    published: p.status === 'published',
    views: p.view_count ?? 0,
    saves: p.save_count ?? 0,
    reviews: p.review_count ?? 0,
  }
}

const isBusiness = (p: { entity_type: string }) =>
  p.entity_type !== 'job' && p.entity_type !== 'event'

export default async function LocationsPage({ params }: Props) {
  const { entityId } = await params
  const owner = await requireOwner()
  const supabase = await createClient()

  const { data: pageData, error: pagesError } = await supabase
    .from('listings')
    .select(
      'id, name, status, entity_type, tier, view_count, save_count, review_count, cities(name)'
    )
    .eq('owner_user_id', owner.user.id)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
  const pages = (pageData ?? []) as unknown as PageRow[]
  const self = pages.find((p) => p.id === entityId)
  if (!self) notFound()

  if (!isBusiness(self)) {
    return (
      <div className="max-w-2xl space-y-4">
        <Heading name={self.name} />
        <p className={NOTE}>
          Locations are for business pages. A {self.entity_type} page can&rsquo;t be linked.
        </p>
      </div>
    )
  }

  const linksRead = await supabase
    .from('listing_location_links')
    .select(LOCATION_LINK_COLUMNS)
    .eq('owner_user_id', owner.user.id)
  if (pagesError || linksRead.error) {
    return (
      <div className="max-w-2xl space-y-4">
        <Heading name={self.name} />
        <p className={NOTE}>
          We couldn&rsquo;t load your locations right now. Please try again in a moment.
        </p>
      </div>
    )
  }
  const links = toLocationLinkRows(linksRead.data)
  const byId = new Map(pages.map((p) => [p.id, p]))

  // A linked location: say which page it is linked to.
  const asLocation = links.find((l) => l.location_listing_id === self.id)
  if (asLocation) {
    const primary = byId.get(asLocation.primary_listing_id)
    return (
      <div className="max-w-2xl space-y-4">
        <Heading name={self.name} />
        <div className={NOTE}>
          <p>
            This page is a linked location of{' '}
            {primary ? (
              <Link
                href={`/dashboard/pages/${primary.id}/locations`}
                className="font-semibold underline underline-offset-2"
              >
                {primary.name}
              </Link>
            ) : (
              'another of your pages'
            )}
            . Linked pages show each other under Also At.
          </p>
          <p className="mt-2 text-charcoal-soft">Unlink it to take it out of the group.</p>
          <div className="mt-4">
            <UnlinkSelfButton locationId={self.id} name={self.name} />
          </div>
        </div>
      </div>
    )
  }

  // Linking comes with the owner's plan (ticket 238), not this page's.
  const planTier = highestTier(pages)
  const covers = coversLocations(planTier)
  const mine = links.filter((l) => l.primary_listing_id === self.id)
  const linked = mine
    .map((l) => byId.get(l.location_listing_id))
    .filter((p): p is PageRow => Boolean(p))
    .map(toOwnerLocation)

  // Pages that could be linked: the owner's other business pages that aren't
  // in a group already.
  const grouped = new Set(links.flatMap((l) => [l.location_listing_id, l.primary_listing_id]))
  const candidates: LinkCandidate[] = pages
    .filter((p) => p.id !== self.id && isBusiness(p) && !grouped.has(p.id))
    .map((p) => ({ id: p.id, name: p.name, cityName: p.cities?.name ?? '' }))

  const slots = linkedSlots(planTier)
  const total = locationLimit('premium') ?? 3
  const premiumOpen = covers ? false : await premiumIsOpen()

  return (
    <div className="max-w-3xl space-y-6">
      <Heading name={self.name} />
      {!covers && (
        <PlanLimitNote upgradeTo={premiumOpen ? 'Premium' : null}>
          Premium links up to {total} locations of one business: this page and {total - 1} more.
          Linked pages show each other under Also At.
        </PlanLimitNote>
      )}
      {(covers || linked.length > 0) && (
        <LocationsManager
          primary={toOwnerLocation(self)}
          linked={linked}
          candidates={candidates}
          covers={covers}
          slotsLeft={covers ? Math.max(0, slots - linked.length) : 0}
          total={covers ? slots + 1 : total}
        />
      )}
    </div>
  )
}
