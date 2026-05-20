import { notFound } from "next/navigation"
import Link from "next/link"
import { ExternalLink } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { requireOwner } from "@/lib/dashboard/guard"
import { buildEntityUrl } from "@/lib/listings/url"
import { BasicInfoSection } from "@/components/dashboard/BasicInfoSection"
import { AboutSection } from "@/components/dashboard/AboutSection"
import { ContactSection } from "@/components/dashboard/ContactSection"
import { SocialSection } from "@/components/dashboard/SocialSection"
import { CtaSection } from "@/components/dashboard/CtaSection"
import { SeoSection } from "@/components/dashboard/SeoSection"
import { HoursSection } from "@/components/dashboard/HoursSection"

interface Props {
  params: Promise<{ entityId: string }>
}

export default async function EditPage({ params }: Props) {
  const { entityId } = await params
  const owner = await requireOwner()
  const supabase = await createClient()

  const { data: listing } = await supabase
    .from("listings")
    .select(`
      id, name, slug, status, entity_type, tagline, meta_title, meta_description,
      cities(slug, name),
      listing_details_business(
        description, phone, email, website_url,
        address_line_1, address_line_2, state, zip,
        social_instagram, social_facebook, social_linkedin,
        social_tiktok, social_youtube, social_twitter,
        cta_type, cta_url, cta_label_override,
        hours
      )
    `)
    .eq("id", entityId)
    .eq("owner_user_id", owner.user.id)
    .is("deleted_at", null)
    .maybeSingle()

  if (!listing) notFound()

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
            <span className={`px-2 py-0.5 rounded-full font-subhead text-xs font-semibold ${
              listing.status === "published"
                ? "bg-green-100 text-green-700"
                : listing.status === "pending"
                ? "bg-amber-100 text-amber-700"
                : "bg-charcoal/10 text-charcoal/60"
            }`}>
              {listing.status}
            </span>
            {city && <p className="font-body text-xs text-charcoal/50">{city.name}</p>}
          </div>
        </div>
        {publicUrl && (
          <Link
            href={publicUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 inline-flex items-center gap-1.5 font-subhead text-xs text-charcoal/50 hover:text-brand-black transition-colors"
          >
            Preview <ExternalLink className="size-3" aria-hidden="true" />
          </Link>
        )}
      </div>

      <BasicInfoSection
        listingId={listing.id}
        name={listing.name}
        tagline={listing.tagline}
      />

      <AboutSection
        listingId={listing.id}
        description={details?.description ?? null}
      />

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

      <HoursSection
        listingId={listing.id}
        hours={details?.hours ?? null}
      />

      <SocialSection
        listingId={listing.id}
        socialInstagram={details?.social_instagram ?? null}
        socialFacebook={details?.social_facebook ?? null}
        socialLinkedin={details?.social_linkedin ?? null}
        socialTiktok={details?.social_tiktok ?? null}
        socialYoutube={details?.social_youtube ?? null}
        socialTwitter={details?.social_twitter ?? null}
      />

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
