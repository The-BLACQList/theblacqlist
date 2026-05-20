import Link from 'next/link'
import { Package } from 'lucide-react'
import { CTAButton } from './CTAButton'

interface ProductCardProps {
  product: {
    id: string
    name: string
    global_slug: string
    description: string | null
    price_cents: number | null
    compare_at_price_cents: number | null
    price_display_text: string | null
    cover_image_url: string | null
    shipping_options: string
    external_purchase_url: string | null
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

export function ProductCard({ product, showVendor = false }: ProductCardProps) {
  const priceLabel =
    product.price_display_text ??
    (product.price_cents ? formatPrice(product.price_cents) : 'Contact for pricing')

  const compareLabel = product.compare_at_price_cents
    ? formatPrice(product.compare_at_price_cents)
    : null

  const ctaType = product.external_purchase_url ? 'shop-now' : 'visit-website'

  return (
    <article className="rounded-xl border border-charcoal/10 bg-white overflow-hidden flex flex-col">
      {/* Cover image */}
      <div className="aspect-[4/3] bg-pale-lavender relative overflow-hidden">
        {product.cover_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.cover_image_url}
            alt={product.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Package className="size-10 text-charcoal/20" aria-hidden="true" />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4 flex flex-col flex-1 gap-2">
        {showVendor && product.vendor_name && (
          <p className="font-subhead text-xs text-charcoal/50 truncate">
            {product.vendor_slug ? (
              <Link href={`/vendors/${product.vendor_slug}`} className="hover:text-charcoal">
                {product.vendor_name}
              </Link>
            ) : (
              product.vendor_name
            )}
          </p>
        )}

        <h3 className="font-headline text-base text-brand-black leading-snug">
          <Link
            href={`/marketplace/products/${product.global_slug}`}
            className="hover:text-amber-gold transition-colors"
          >
            {product.name}
          </Link>
        </h3>

        {product.description && (
          <p className="font-body text-xs text-charcoal/60 line-clamp-2">{product.description}</p>
        )}

        {/* Price */}
        <div className="flex items-baseline gap-2 mt-auto pt-2">
          <span className="font-subhead text-base font-bold text-brand-black">{priceLabel}</span>
          {compareLabel && (
            <span className="font-body text-xs text-charcoal/40 line-through">{compareLabel}</span>
          )}
        </div>

        {/* Shipping */}
        <p className="font-body text-[10px] text-charcoal/40 capitalize">
          {product.shipping_options === 'digital'
            ? 'Digital delivery'
            : product.shipping_options === 'pickup'
              ? 'Pickup only'
              : product.shipping_options === 'both'
                ? 'Ships + pickup'
                : product.shipping_options === 'none'
                  ? 'No shipping'
                  : 'Ships nationwide'}
        </p>

        {/* CTA */}
        {product.external_purchase_url && (
          <div className="pt-2">
            <CTAButton
              href={product.external_purchase_url}
              label="Shop Now"
              ctaType={ctaType}
              entityType="product"
              entityId={product.id}
              listingId={product.listing_id}
              variant="primary"
            />
          </div>
        )}
      </div>
    </article>
  )
}
