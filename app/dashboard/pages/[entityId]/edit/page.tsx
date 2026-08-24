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
import { loadAttributeGroups } from '@/lib/listings/facets'
import { BasicInfoSection } from '@/components/dashboard/BasicInfoSection'
import { AboutSection } from '@/components/dashboard/AboutSection'
import { ContactSection } from '@/components/dashboard/ContactSection'
import { SocialSection } from '@/components/dashboard/SocialSection'
import { AttributesSection } from '@/components/dashboard/AttributesSection'
import { VideoSection } from '@/components/dashboard/VideoSection'
import { LinksSection } from '@/components/dashboard/LinksSection'
import { FaqSection } from '@/components/dashboard/FaqSection'
import { EventDetailsSection } from '@/components/dashboard/EventDetailsSection'
import { JobDetailsSection } from '@/components/dashboard/JobDetailsSection'
import { CtaSection } from '@/components/dashboard/CtaSection'
import { SeoSection } from '@/components/dashboard/SeoSection'
import { HoursSection } from '@/components/dashboard/HoursSection'
import { PublishSection } from '@/components/dashboard/PublishSection'

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
      id, name, slug, status, trust_tier, entity_type, tagline, meta_title, meta_description,
      created_at,
      cities(slug, name),
      listing_details_business(
        description, phone, email, website_url,
        address_line_1, address_line_2, state, zip,
        social_instagram, social_facebook, social_linkedin,
        social_tiktok, social_youtube, social_twitter,
        cta_type, cta_url, cta_label_override,
        hours
      )
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

  // Attribute groups for this entity type + the listing's current selections,
  // plus the (fail-soft) video field — queried separately so a not-yet-migrated
  // column can't break the editor.
  const sb = supabase as unknown as SupabaseClient
  const [
    attributeGroups,
    { data: selectedAttrRows },
    { data: videoRow },
    { data: linkRows },
    { data: faqRows },
  ] = await Promise.all([
      loadAttributeGroups(supabase, listing.entity_type),
      sb.from('listing_attributes').select('value_id').eq('listing_id', listing.id),
      sb
        .from('listing_details_business')
        .select('video_embed_url')
        .eq('listing_id', listing.id)
        .maybeSingle(),
      sb
        .from('listing_links')
        .select('id, link_type, url, label')
        .eq('listing_id', listing.id)
        .order('display_order', { ascending: true }),
      // Fail-soft: listing_faqs may not be migrated yet.
      sb
        .from('listing_faqs')
        .select('id, question, answer')
        .eq('listing_id', listing.id)
        .order('display_order', { ascending: true }),
    ])
  const selectedValueIds = ((selectedAttrRows as { value_id: string }[] | null) ?? []).map(
    (r) => r.value_id
  )
  const videoEmbedUrl =
    (videoRow as { video_embed_url: string | null } | null)?.video_embed_url ?? null
  const links =
    (linkRows as { id: string; link_type: string; url: string; label: string | null }[] | null) ??
    []
  const faqs =
    (faqRows as { id: string; question: string; answer: string }[] | null) ?? []

  const details = listing.listing_details_business as {
    description: string | null
    phone: string | null
    email: string | null
    website_url: string | null
    address_line_1: string | null
    address_line_2: string | null
    state: string | null
    zip: string | null
    social_instagram: string | null
    social_facebook: string | null
    social_linkedin: string | null
    social_tiktok: string | null
    social_youtube: string | null
    social_twitter: string | null
    cta_type: string | null
    cta_url: string | null
    cta_label_override: string | null
    hours: Record<string, { open: string; close: string; closed: boolean }> | null
  } | null

  const city = listing.cities as { slug: string; name: string } | null
  const publicUrl = buildEntityUrl(listing.entity_type, city?.slug, listing.slug)

  return (
    <div className="max-w-2xl space-y-6">
      {/* Page header */}
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
            {city && <p className="font-body text-xs text-charcoal-soft">{city.name}</p>}
          </div>
        </div>
        {publicUrl && (
          <Link
            href={publicUrl}
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

      <AboutSection listingId={listing.id} description={details?.description ?? null} />

      <ContactSection
        listingId={listing.id}
        phone={details?.phone ?? null}
        email={details?.email ?? null}
        websiteUrl={details?.website_url ?? null}
        addressLine1={details?.address_line_1 ?? null}
        addressLine2={details?.address_line_2 ?? null}
        state={details?.state ?? null}
        zip={details?.zip ?? null}
      />

      <HoursSection listingId={listing.id} hours={details?.hours ?? null} />

      <SocialSection
        listingId={listing.id}
        socialInstagram={details?.social_instagram ?? null}
        socialFacebook={details?.social_facebook ?? null}
        socialLinkedin={details?.social_linkedin ?? null}
        socialTiktok={details?.social_tiktok ?? null}
        socialYoutube={details?.social_youtube ?? null}
        socialTwitter={details?.social_twitter ?? null}
      />

      <AttributesSection
        listingId={listing.id}
        groups={attributeGroups}
        selectedValueIds={selectedValueIds}
      />

      <VideoSection listingId={listing.id} videoEmbedUrl={videoEmbedUrl} />

      <LinksSection listingId={listing.id} links={links} />

      <FaqSection listingId={listing.id} faqs={faqs} />

      <CtaSection
        listingId={listing.id}
        ctaType={details?.cta_type ?? null}
        ctaUrl={details?.cta_url ?? null}
        ctaLabelOverride={details?.cta_label_override ?? null}
      />

      <SeoSection
        listingId={listing.id}
        metaTitle={listing.meta_title}
        metaDescription={listing.meta_description}
        name={listing.name}
        description={details?.description ?? null}
      />
    </div>
  )
}
