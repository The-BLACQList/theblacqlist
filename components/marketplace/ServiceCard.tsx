import Link from 'next/link'
import Image from 'next/image'
import { Briefcase, Globe, MapPin, Plane } from 'lucide-react'
import { CTAButton } from './CTAButton'
import { resolveRemoteImage } from '@/lib/listings/coverImage'

interface ServiceCardProps {
  service: {
    id: string
    name: string
    global_slug: string
    description: string | null
    starting_price_cents: number | null
    price_display_text: string | null
    duration_text: string | null
    delivery_mode: string
    booking_url: string | null
    cover_image_url: string | null
    listing_id: string
    vendor_name?: string
    vendor_slug?: string
  }
  showVendor?: boolean
}

function formatPrice(cents: number): string {
  return (cents / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  })
}

const DELIVERY_ICONS: Record<string, React.ElementType> = {
  virtual: Globe,
  in_person: MapPin,
  travel: Plane,
  hybrid: Globe,
}

const DELIVERY_LABELS: Record<string, string> = {
  virtual: 'Virtual',
  in_person: 'In person',
  travel: 'Provider travels',
  hybrid: 'Virtual + in person',
}

export function ServiceCard({ service, showVendor = false }: ServiceCardProps) {
  const priceLabel =
    service.price_display_text ??
    (service.starting_price_cents != null
      ? `Starting at ${formatPrice(service.starting_price_cents)}`
      : 'Contact for pricing')

  const ctaType = service.booking_url ? 'book-now' : 'request-quote'
  const ctaLabel = service.booking_url ? 'Book Now' : 'Request Quote'
  const DeliveryIcon = DELIVERY_ICONS[service.delivery_mode] ?? Briefcase

  // See ProductCard: owner-supplied host, may not be optimizable.
  const cover = resolveRemoteImage(service.cover_image_url)

  return (
    <article className="rounded-xl border border-charcoal/10 bg-white overflow-hidden flex flex-col">
      {/* Cover image */}
      <div className="aspect-[4/3] bg-pale-lavender relative overflow-hidden">
        {cover ? (
          <Image
            src={cover.src}
            unoptimized={cover.unoptimized}
            alt={service.name}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Briefcase className="size-10 text-charcoal/20" aria-hidden="true" />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4 flex flex-col flex-1 gap-2">
        {showVendor && service.vendor_name && (
          <p className="font-subhead text-xs text-charcoal-soft truncate">
            {service.vendor_slug ? (
              <Link href={`/vendors/${service.vendor_slug}`} className="hover:text-charcoal">
                {service.vendor_name}
              </Link>
            ) : (
              service.vendor_name
            )}
          </p>
        )}

        <h3 className="font-headline text-base text-brand-black leading-snug">
          <Link
            href={`/marketplace/services/${service.global_slug}`}
            className="hover:text-amber transition-colors"
          >
            {service.name}
          </Link>
        </h3>

        {service.description && (
          <p className="font-body text-xs text-charcoal-soft line-clamp-2">{service.description}</p>
        )}

        {/* Price + duration */}
        <div className="flex items-baseline gap-2 mt-auto pt-2">
          <span className="font-subhead text-base font-bold text-brand-black">{priceLabel}</span>
          {service.duration_text && (
            <span className="font-body text-xs text-charcoal-faint">{service.duration_text}</span>
          )}
        </div>

        {/* Delivery mode */}
        <p className="font-body text-[10px] text-charcoal-faint flex items-center gap-1">
          <DeliveryIcon className="size-3 shrink-0" aria-hidden="true" />
          {DELIVERY_LABELS[service.delivery_mode] ?? service.delivery_mode}
        </p>

        {/* CTA */}
        {service.booking_url && (
          <div className="pt-2">
            <CTAButton
              href={service.booking_url}
              label={ctaLabel}
              ctaType={ctaType}
              entityType="service"
              entityId={service.id}
              listingId={service.listing_id}
              variant="primary"
            />
          </div>
        )}
      </div>
    </article>
  )
}
