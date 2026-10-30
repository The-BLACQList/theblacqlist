import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { JOB_POSTING_PRICE_DISPLAY, ownerPlanTier } from '@/lib/stripe/jobPostings'
import { getPlanMeta } from '@/lib/stripe/plans'
import { buildEntityUrl } from '@/lib/listings/url'
import {
  buildConfirmationModel,
  publicRejectionReason,
  type LedgerRow,
} from '@/lib/jobs/confirmation'
import { PostedView } from '@/components/jobs/posted/PostedView'

export const metadata = { title: 'Your role | The BLACQList' }

// Reads the ledger on every request; a stale "in review" would be wrong.
export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ entityId: string }>
  searchParams: Promise<{ paid?: string }>
}

interface ListingRow {
  id: string
  name: string
  slug: string
  status: string
  entity_type: string
  created_at: string
  moderation_notes: string | null
  cities: { slug: string } | { slug: string }[] | null
}

export default async function PostedPage({ params, searchParams }: Props) {
  const { entityId } = await params
  const returnedFromCheckout = (await searchParams).paid === '1'

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/sign-in?next=${encodeURIComponent(`/dashboard/pages/${entityId}/posted`)}`)

  // Ownership is checked here on the server, in the query itself.
  const { data } = await supabase
    .from('listings')
    .select('id, name, slug, status, entity_type, created_at, moderation_notes, cities(slug)')
    .eq('id', entityId)
    .eq('owner_user_id', user.id)
    .eq('entity_type', 'job')
    .is('deleted_at', null)
    .maybeSingle()
  if (!data) notFound()
  const listing = data as unknown as ListingRow

  const [detailsRes, ledgerRes] = await Promise.all([
    supabase
      .from('listing_details_job')
      .select('closes_at, hiring_listing_id')
      .eq('listing_id', listing.id)
      .maybeSingle(),
    // Never trust ?paid=1: the webhook-written ledger is the only proof of payment.
    supabase
      .from('job_posting_purchases')
      .select('source, status, amount_cents, paid_at')
      .eq('listing_id', listing.id)
      .eq('status', 'paid')
      .order('paid_at', { ascending: false, nullsFirst: false })
      .limit(1),
  ])
  const details = detailsRes.data as { closes_at: string | null; hiring_listing_id: string | null } | null
  const ledger = ((ledgerRes.data ?? [])[0] ?? null) as LedgerRow | null

  let tierName: string | null = null
  if (ledger?.source === 'entitlement') {
    const tier = await ownerPlanTier(supabase, user.id)
    if (tier.ok && tier.value !== 'free') tierName = getPlanMeta(tier.value).name
  }

  let businessName: string | null = null
  if (details?.hiring_listing_id) {
    const { data: biz } = await supabase
      .from('listings')
      .select('name')
      .eq('id', details.hiring_listing_id)
      .maybeSingle()
    businessName = (biz as { name: string } | null)?.name ?? null
  }

  const model = buildConfirmationModel({
    status: listing.status,
    ledger,
    ledgerFailed: Boolean(ledgerRes.error),
    returnedFromCheckout,
    tierName,
    submittedAt: ledger?.paid_at ?? listing.created_at,
    closesAt: details?.closes_at ?? null,
    rejectionReason: publicRejectionReason(listing.moderation_notes),
    fallbackPrice: JOB_POSTING_PRICE_DISPLAY,
  })
  if (model.kind === 'redirect') redirect(`/dashboard/pages/${entityId}/edit`)

  const city = Array.isArray(listing.cities) ? listing.cities[0] : listing.cities
  const publicHref = buildEntityUrl('job', city?.slug, listing.slug)

  return (
    <PostedView
      model={model}
      entityId={listing.id}
      roleTitle={listing.name}
      businessName={businessName}
      publicHref={publicHref}
    />
  )
}
