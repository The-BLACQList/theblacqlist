import { notFound } from "next/navigation"
import type { Metadata } from "next"
import Link from "next/link"
import { Briefcase, Globe, MapPin, Plane, ArrowLeft } from "lucide-react"

import { createServiceClient } from "@/lib/supabase/server"
import { CTAButton } from "@/components/marketplace/CTAButton"

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const serviceClient = createServiceClient()
  const { data } = await serviceClient
    .from("marketplace_services")
    .select("name, description")
    .eq("global_slug", slug)
    .eq("status", "active")
    .maybeSingle()

  if (!data) return { title: "Service | BLACQList Marketplace" }

  return {
    title: `${data.name} | BLACQList Marketplace`,
    description: data.description ?? `Book ${data.name} on BLACQList Marketplace.`,
  }
}

export const revalidate = 1800

const DELIVERY_LABELS: Record<string, string> = {
  virtual:   "Virtual",
  in_person: "In person",
  travel:    "Provider travels to you",
  hybrid:    "Virtual + in person",
}

const DELIVERY_ICONS: Record<string, React.ElementType> = {
  virtual:   Globe,
  in_person: MapPin,
  travel:    Plane,
  hybrid:    Globe,
}

export default async function ServiceDetailPage({ params }: Props) {
  const { slug } = await params
  const serviceClient = createServiceClient()

  const { data: svc } = await serviceClient
    .from("marketplace_services")
    .select("*, listings(id, name, slug, trust_tier)")
    .eq("global_slug", slug)
    .eq("status", "active")
    .maybeSingle()

  if (!svc) notFound()

  type ListingRef = { id: string; name: string; slug: string; trust_tier: string } | null
  const listing = svc.listings as ListingRef

  function formatPrice(cents: number): string {
    return (cents / 100).toLocaleString("en-US", {
      style:                 "currency",
      currency:              "USD",
      maximumFractionDigits: 0,
    })
  }

  const priceLabel = svc.price_display_text
    ?? (svc.starting_price_cents != null
      ? `Starting at ${formatPrice(svc.starting_price_cents)}`
      : "Contact for pricing")

  const ctaType  = svc.booking_url ? "book-now" : "request-quote"
  const ctaLabel = svc.booking_url ? "Book Now" : "Request Quote"
  const DeliveryIcon = DELIVERY_ICONS[svc.delivery_mode] ?? Briefcase

  return (
    <div className="min-h-screen bg-cream">
      <div className="max-w-5xl mx-auto px-4 md:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="mb-6">
          <ol className="flex items-center gap-1.5 font-body text-xs text-charcoal/40">
            <li><Link href="/marketplace" className="hover:text-charcoal">Marketplace</Link></li>
            <li aria-hidden="true">/</li>
            <li><Link href="/marketplace/services" className="hover:text-charcoal">Services</Link></li>
            <li aria-hidden="true">/</li>
            <li className="text-charcoal truncate max-w-[200px]" aria-current="page">{svc.name}</li>
          </ol>
        </nav>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
          {/* Image */}
          <div className="aspect-square rounded-xl bg-pale-lavender overflow-hidden">
            {svc.cover_image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={svc.cover_image_url}
                alt={svc.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Briefcase className="size-16 text-charcoal/20" aria-hidden="true" />
              </div>
            )}
          </div>

          {/* Details */}
          <div className="space-y-5">
            {listing && (
              <p className="font-subhead text-sm text-charcoal/50">
                Offered by{" "}
                <Link href={`/vendors/${listing.slug}`} className="font-semibold text-brand-black hover:text-amber-gold">
                  {listing.name}
                </Link>
              </p>
            )}

            <h1 className="font-headline text-3xl text-brand-black">{svc.name}</h1>

            {/* Price + duration */}
            <div className="flex items-baseline gap-3">
              <span className="font-subhead text-2xl font-bold text-brand-black">{priceLabel}</span>
              {svc.duration_text && (
                <span className="font-body text-sm text-charcoal/40">{svc.duration_text}</span>
              )}
            </div>

            {/* Delivery mode */}
            <p className="flex items-center gap-1.5 font-body text-sm text-charcoal/60">
              <DeliveryIcon className="size-4 shrink-0" aria-hidden="true" />
              {DELIVERY_LABELS[svc.delivery_mode] ?? svc.delivery_mode}
            </p>

            {/* CTA */}
            {svc.booking_url && (
              <CTAButton
                href={svc.booking_url}
                label={ctaLabel}
                ctaType={ctaType}
                entityType="service"
                entityId={svc.id}
                listingId={svc.listing_id}
                variant="primary"
              />
            )}

            {/* Description */}
            {svc.description && (
              <div className="rounded-xl bg-white border border-charcoal/10 p-5">
                <h2 className="font-subhead text-xs font-semibold uppercase tracking-wide text-charcoal/50 mb-2">
                  About this service
                </h2>
                <p className="font-body text-sm text-charcoal leading-relaxed whitespace-pre-line">
                  {svc.description}
                </p>
              </div>
            )}

            <Link
              href="/marketplace/services"
              className="inline-flex items-center gap-1.5 font-subhead text-xs text-charcoal/40 hover:text-charcoal"
            >
              <ArrowLeft className="size-3" aria-hidden="true" />
              Back to services
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
