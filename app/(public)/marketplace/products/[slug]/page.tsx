import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import { Package, ArrowLeft } from 'lucide-react'
import Image from 'next/image'

import { createServiceClient } from '@/lib/supabase/server'
import { CTAButton } from '@/components/marketplace/CTAButton'

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const serviceClient = createServiceClient()
  const { data } = await serviceClient
    .from('marketplace_products')
    .select('name, description')
    .eq('global_slug', slug)
    .eq('status', 'active')
    .maybeSingle()

  if (!data) return { title: 'Product | BLACQList Marketplace' }

  return {
    title: `${data.name} | BLACQList Marketplace`,
    description: data.description ?? `Shop ${data.name} on BLACQList Marketplace.`,
  }
}

export const revalidate = 1800

export default async function ProductDetailPage({ params }: Props) {
  const { slug } = await params
  const serviceClient = createServiceClient()

  const { data: product } = await serviceClient
    .from('marketplace_products')
    .select('*, listings(id, name, slug, trust_tier)')
    .eq('global_slug', slug)
    .eq('status', 'active')
    .maybeSingle()

  if (!product) notFound()

  type ListingRef = { id: string; name: string; slug: string; trust_tier: string } | null
  const listing = product.listings as ListingRef

  function formatPrice(cents: number): string {
    return (cents / 100).toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    })
  }

  const priceLabel =
    product.price_display_text ??
    (product.price_cents ? formatPrice(product.price_cents) : 'Contact for pricing')

  const compareLabel = product.compare_at_price_cents
    ? formatPrice(product.compare_at_price_cents)
    : null

  const shippingLabel: Record<string, string> = {
    shipping: 'Ships nationwide',
    pickup: 'Pickup only',
    both: 'Ships + pickup',
    digital: 'Digital delivery',
    none: 'No shipping',
  }

  return (
    <div className="min-h-screen bg-cream">
      <div className="max-w-5xl mx-auto px-4 md:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="mb-6">
          <ol className="flex items-center gap-1.5 font-body text-xs text-charcoal-faint">
            <li>
              <Link href="/marketplace" className="hover:text-charcoal">
                Marketplace
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li>
              <Link href="/marketplace/products" className="hover:text-charcoal">
                Products
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li className="text-charcoal truncate max-w-[200px]" aria-current="page">
              {product.name}
            </li>
          </ol>
        </nav>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
          {/* Image */}
          <div className="aspect-square rounded-xl bg-pale-lavender overflow-hidden relative">
            {product.cover_image_url ? (
              <Image
                src={product.cover_image_url}
                alt={product.name}
                fill
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-cover"
                priority
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Package className="size-16 text-charcoal/20" aria-hidden="true" />
              </div>
            )}
          </div>

          {/* Details */}
          <div className="space-y-5">
            {/* Vendor */}
            {listing && (
              <p className="font-subhead text-sm text-charcoal-soft">
                Sold by{' '}
                <Link
                  href={`/vendors/${listing.slug}`}
                  className="font-semibold text-brand-black hover:text-amber"
                >
                  {listing.name}
                </Link>
              </p>
            )}

            <h1 className="font-headline text-3xl text-brand-black">{product.name}</h1>

            {/* Price */}
            <div className="flex items-baseline gap-3">
              <span className="font-subhead text-2xl font-bold text-brand-black">{priceLabel}</span>
              {compareLabel && (
                <span className="font-body text-base text-charcoal-faint line-through">
                  {compareLabel}
                </span>
              )}
            </div>

            {/* CTA */}
            {product.external_purchase_url && (
              <CTAButton
                href={product.external_purchase_url}
                label="Shop Now"
                ctaType="shop-now"
                entityType="product"
                entityId={product.id}
                listingId={product.listing_id}
                variant="primary"
              />
            )}

            {/* Description */}
            {product.description && (
              <div className="rounded-xl bg-white border border-charcoal/10 p-5">
                <h2 className="font-subhead text-xs font-semibold uppercase tracking-wide text-charcoal-soft mb-2">
                  About this product
                </h2>
                <p className="font-body text-sm text-charcoal leading-relaxed whitespace-pre-line">
                  {product.description}
                </p>
              </div>
            )}

            {/* Tags */}
            {product.tags && product.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {product.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-0.5 rounded-full bg-pale-lavender font-subhead text-xs text-charcoal-soft"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* Shipping + return policy */}
            <div className="space-y-2 pt-2 border-t border-charcoal/10">
              <p className="font-body text-xs text-charcoal-soft">
                <span className="font-semibold text-charcoal">Fulfillment:</span>{' '}
                {shippingLabel[product.shipping_options] ?? product.shipping_options}
              </p>
              {product.return_policy_note && (
                <p className="font-body text-xs text-charcoal-soft">
                  <span className="font-semibold text-charcoal">Returns:</span>{' '}
                  {product.return_policy_note}
                </p>
              )}
            </div>

            {/* Back link */}
            <Link
              href="/marketplace/products"
              className="inline-flex items-center gap-1.5 font-subhead text-xs text-charcoal-faint hover:text-charcoal mt-2"
            >
              <ArrowLeft className="size-3" aria-hidden="true" />
              Back to products
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
