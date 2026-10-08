import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { isFeatureEnabled } from '@/lib/env'
import { requireOwner } from '@/lib/dashboard/guard'
import {
  hasPaidJobPosting,
  jobQuotaFor,
  JOB_LIMIT_ENFORCED_FROM,
  JOB_POSTING_PRICE_DISPLAY,
} from '@/lib/stripe/jobPostings'
import { buildEntityUrl } from '@/lib/listings/url'
import { BasicInfoSection } from '@/components/dashboard/BasicInfoSection'
import { EventDetailsSection } from '@/components/dashboard/EventDetailsSection'
import { JobDetailsSection } from '@/components/dashboard/JobDetailsSection'
import { SeoSection } from '@/components/dashboard/SeoSection'
import { PublishSection } from '@/components/dashboard/PublishSection'
import { loadFinishData } from '@/lib/listings/finishData'
import { PageFinishView } from '@/components/listings/PageFinishView'

interface Props {
  params: Promise<{ entityId: string }>
}

export default async function EditPage({ params }: Props) {
  const { entityId } = await params
  const owner = await requireOwner()
  const supabase = await createClient()

  const { data: listing } = await supabase
    .from('listings')
    .select(
      `
      id, name, slug, status, trust_tier, entity_type, tier, tagline, meta_title, meta_description,
      created_at,
      cities(slug, name)
    `
    )
    .eq('id', entityId)
    .eq('owner_user_id', owner.user.id)
    .is('deleted_at', null)
    .maybeSingle()

  if (!listing) notFound()

  // Events use a dedicated editor — the business-shaped sections below don't apply.
  if (listing.entity_type === 'event') {
    const sbEvent = supabase as unknown as SupabaseClient
    const [{ data: eventRow }, { data: ownerBusinesses }] = await Promise.all([
      sbEvent
        .from('listing_details_event')
        .select(
          'starts_at, ends_at, is_online, venue_name, venue_address, city_text, state, ticket_url, price_text, description, organizer_listing_id'
        )
        .eq('listing_id', listing.id)
        .maybeSingle(),
      supabase
        .from('listings')
        .select('id, name')
        .eq('owner_user_id', owner.user.id)
        .neq('entity_type', 'event')
        .is('deleted_at', null)
        .order('name'),
    ])
    const cityE = listing.cities as { slug: string; name: string } | null
    const publicUrlE = buildEntityUrl(listing.entity_type, cityE?.slug, listing.slug)

    return (
      <div className="max-w-2xl space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-headline text-2xl text-brand-black">{listing.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span
                className={`px-2 py-0.5 rounded-full font-subhead text-xs font-semibold ${
                  listing.status === 'published'
                    ? 'bg-green-100 text-green-700'
                    : listing.status === 'pending'
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-charcoal/10 text-charcoal-soft'
                }`}
              >
                {listing.status}
              </span>
              <span className="font-subhead text-xs text-amber">Event</span>
            </div>
          </div>
          {publicUrlE && (
            <Link
              href={publicUrlE}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 inline-flex items-center gap-1.5 font-subhead text-xs text-charcoal-soft hover:text-brand-black transition-colors"
            >
              Preview <ExternalLink className="size-3" aria-hidden="true" />
            </Link>
          )}
        </div>

        <PublishSection
          listingId={listing.id}
          status={listing.status}
          trustTier={listing.trust_tier}
          entityType={listing.entity_type}
        />

        <BasicInfoSection listingId={listing.id} name={listing.name} tagline={listing.tagline} />

        <EventDetailsSection
          listingId={listing.id}
          event={eventRow ?? null}
          businesses={(ownerBusinesses ?? []) as { id: string; name: string }[]}
        />

        <SeoSection
          listingId={listing.id}
          metaTitle={listing.meta_title}
          metaDescription={listing.meta_description}
          name={listing.name}
          description={(eventRow as { description?: string | null } | null)?.description ?? null}
        />
      </div>
    )
  }

  // Jobs use a dedicated editor for the same reason events do.
  if (listing.entity_type === 'job') {
    const sbJob = supabase as unknown as SupabaseClient
    const [{ data: jobRow }, { data: ownerBusinesses }] = await Promise.all([
      sbJob
        .from('listing_details_job')
        .select(
          'description, employment_type, workplace_type, salary_min, salary_max, salary_period, salary_currency, apply_url, apply_email, closes_at, hiring_listing_id'
        )
        .eq('listing_id', listing.id)
        .maybeSingle(),
      supabase
        .from('listings')
        .select('id, name')
        .eq('owner_user_id', owner.user.id)
        .neq('entity_type', 'job')
        .is('deleted_at', null)
        .order('name'),
    ])
    const cityJ = listing.cities as { slug: string; name: string } | null
    const publicUrlJ = buildEntityUrl(listing.entity_type, cityJ?.slug, listing.slug)
    // Postgres `numeric` arrives as a string over PostgREST — coerce before the
    // number inputs get it, or the defaultValue silently mismatches.
    const jobRaw = jobRow as Record<string, unknown> | null
    const num = (v: unknown) => (v === null || v === undefined ? null : Number(v))
    const job = jobRaw
      ? {
          description: (jobRaw.description as string | null) ?? null,
          employment_type: jobRaw.employment_type as string,
          workplace_type: jobRaw.workplace_type as string,
          salary_min: num(jobRaw.salary_min),
          salary_max: num(jobRaw.salary_max),
          salary_period: (jobRaw.salary_period as string | null) ?? null,
          salary_currency: (jobRaw.salary_currency as string | null) ?? 'USD',
          apply_url: (jobRaw.apply_url as string | null) ?? null,
          apply_email: (jobRaw.apply_email as string | null) ?? null,
          closes_at: (jobRaw.closes_at as string | null) ?? null,
          hiring_listing_id: (jobRaw.hiring_listing_id as string | null) ?? null,
        }
      : null

    // E-2 Model C — the "N of M included postings used" line above the submit
    // button. Deliberately mirrors the ladder in `submitListingForReviewAction`
    // minus the writes: same flag, same grandfather cutoff, same already-paid
    // check, same quota call. Each rung that skips the line is a rung where
    // submitting costs nothing and there is nothing to warn about. If the two
    // ever disagree, this file is the one that is wrong — the action is the
    // enforcement boundary and re-derives all of it before granting or charging.
    let jobQuota:
      | { limit: number; used: number; atLimit: boolean; priceDisplay: string }
      | undefined
    if (isFeatureEnabled('paidPostings') && listing.status === 'draft') {
      const grandfathered =
        !!listing.created_at && new Date(listing.created_at) < new Date(JOB_LIMIT_ENFORCED_FROM)

      // ⚠ Either read can fail. Here the fail-closed answer is to say nothing:
      // this line is informational, the action re-derives all of it before
      // granting or charging, and a wrong "0 of 1 used" is worse than no line at
      // all. `[Debt ⑮ — fixed 2026-08-24]`
      const paidRead = grandfathered
        ? ({ ok: true, value: true } as const)
        : await hasPaidJobPosting(supabase, listing.id)

      if (paidRead.ok && !paidRead.value) {
        const quotaRead = await jobQuotaFor(supabase, owner.user.id)
        // `limit === null` is "unlimited" — no tier is, but the type allows it
        // and an unlimited allowance has nothing to tell the owner.
        if (quotaRead.ok && quotaRead.value.limit !== null) {
          jobQuota = {
            limit: quotaRead.value.limit,
            used: quotaRead.value.used,
            atLimit: quotaRead.value.atLimit,
            priceDisplay: JOB_POSTING_PRICE_DISPLAY,
          }
        }
      }
    }

    return (
      <div className="max-w-2xl space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-headline text-2xl text-brand-black">{listing.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span
                className={`px-2 py-0.5 rounded-full font-subhead text-xs font-semibold ${
                  listing.status === 'published'
                    ? 'bg-green-100 text-green-700'
                    : listing.status === 'pending'
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-charcoal/10 text-charcoal-soft'
                }`}
              >
                {listing.status}
              </span>
              <span className="font-subhead text-xs text-amber">Job</span>
            </div>
          </div>
          {publicUrlJ && (
            <Link
              href={publicUrlJ}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 inline-flex items-center gap-1.5 font-subhead text-xs text-charcoal-soft hover:text-brand-black transition-colors"
            >
              Preview <ExternalLink className="size-3" aria-hidden="true" />
            </Link>
          )}
        </div>

        <PublishSection
          listingId={listing.id}
          status={listing.status}
          trustTier={listing.trust_tier}
          entityType={listing.entity_type}
          jobQuota={jobQuota}
        />

        <BasicInfoSection listingId={listing.id} name={listing.name} tagline={listing.tagline} />

        <JobDetailsSection
          listingId={listing.id}
          job={job}
          businesses={(ownerBusinesses ?? []) as { id: string; name: string }[]}
        />

        <SeoSection
          listingId={listing.id}
          metaTitle={listing.meta_title}
          metaDescription={listing.meta_description}
          name={listing.name}
          description={job?.description ?? null}
        />
      </div>
    )
  }

  // Every other page (business, creative, service provider, vendor) edits in
  // the same side-by-side finish view a new owner uses (ticket 129).
  const data = await loadFinishData(supabase, listing.id, owner.user.id)
  if (!data) notFound()
  const cityB = listing.cities as { slug: string; name: string } | null
  return (
    <div className="max-w-[1100px] space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h1 className="font-headline text-2xl text-brand-black">{listing.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <span
              className={`px-2 py-0.5 rounded-full font-subhead text-xs font-semibold ${
                listing.status === 'published'
                  ? 'bg-green-100 text-green-700'
                  : listing.status === 'pending'
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-charcoal/10 text-charcoal-soft'
              }`}
            >
              {listing.status}
            </span>
            {cityB && <p className="font-body text-xs text-charcoal-soft">{cityB.name}</p>}
          </div>
        </div>
        {data.publicUrl && (
          <Link
            href={data.publicUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 inline-flex items-center gap-1.5 font-subhead text-xs text-charcoal-soft hover:text-brand-black transition-colors"
          >
            {listing.status === 'published' ? 'View live page' : 'Preview'}{' '}
            <ExternalLink className="size-3" aria-hidden="true" />
          </Link>
        )}
      </div>

      <PageFinishView
        data={data}
        mode="edit"
        storageUrl={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public`}
      />
    </div>
  )
}
