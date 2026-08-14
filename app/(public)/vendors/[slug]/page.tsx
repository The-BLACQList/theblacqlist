import { cache } from 'react'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import { Package, Briefcase, MapPin, ArrowLeft } from 'lucide-react'

import { createServiceClient } from '@/lib/supabase/server'
import { ProductCard } from '@/components/marketplace/ProductCard'
import { ServiceCard } from '@/components/marketplace/ServiceCard'

interface Props {
  params: Promise<{ slug: string }>
}

// A "storefront" is not strictly entity_type = 'vendor'. createProduct.ts and
// createService.ts attach marketplace rows to ANY listing the caller owns, and
// product/service pages link "Sold by" to /vendors/<owner slug> regardless of
// the owner's entity_type. So the resolution rule is: the listing is
// vendor-typed OR it actually sells something. Everything else — which before
// this filter meant every published listing on the site — is notFound().
// cache() dedupes the queries between generateMetadata and the page render.
const getStorefront = cache(async (slug: string) => {
  const serviceClient = createServiceClient()

  const { data: listing } = await serviceClient
    .from('listings')
    .select(
      'id, name, slug, tagline, trust_tier, entity_type, cities(name, states(code)), categories(name)'
    )
    .eq('slug', slug)
    .eq('status', 'published')
    .is('deleted_at', null)
    .maybeSingle()

  if (!listing) return null

  const [{ data: productRows }, { data: serviceRows }] = await Promise.all([
    serviceClient
      .from('marketplace_products')
      .select(
        'id, name, global_slug, description, price_cents, compare_at_price_cents, price_display_text, cover_image_url, shipping_options, external_purchase_url, listing_id'
      )
      .eq('listing_id', listing.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(24),
    serviceClient
      .from('marketplace_services')
      .select(
        'id, name, global_slug, description, starting_price_cents, price_display_text, duration_text, delivery_mode, booking_url, cover_image_url, listing_id'
      )
      .eq('listing_id', listing.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(24),
  ])

  const products = productRows ?? []
  const services = serviceRows ?? []

  if (listing.entity_type !== 'vendor' && products.length === 0 && services.length === 0) {
    return null
  }

  return { listing, products, services }
})

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const storefront = await getStorefront(slug)

  if (!storefront) return { title: 'Vendor | BLACQList Marketplace' }

  const { listing } = storefront
  return {
    title: `${listing.name} | BLACQList Marketplace`,
    description:
      listing.tagline ?? `Shop products and services from ${listing.name} on BLACQList.`,
  }
}

export const revalidate = 1800

export default async function VendorStorefrontPage({ params }: Props) {
  const { slug } = await params
  const storefront = await getStorefront(slug)

  if (!storefront) notFound()

  const { listing } = storefront

  // `cities` has no state_abbr column — it carries state_id and joins out to
  // states.code. Asking PostgREST for cities(name, state_abbr) errored the whole
  // select, so `listing` came back null and notFound() fired above for every
  // vendor. Shape and mapping mirror lib/listings/query.ts:95-103.
  type CityRef = { name: string; states: { code: string } | null } | null
  type CategoryRef = { name: string } | null
  const cityRef = listing.cities as CityRef
  const city = cityRef ? { name: cityRef.name, state_abbr: cityRef.states?.code ?? '' } : null
  const category = listing.categories as CategoryRef

  const products = storefront.products.map((p) => ({
    ...p,
    vendor_name: undefined,
    vendor_slug: undefined,
  }))

  const services = storefront.services.map((s) => ({
    ...s,
    vendor_name: undefined,
    vendor_slug: undefined,
  }))

  const hasProducts = products.length > 0
  const hasServices = services.length > 0

  return (
    <div className="min-h-screen bg-cream">
      {/* Header */}
      <div className="bg-white border-b border-charcoal/10 py-8">
        <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8">
          <nav aria-label="Breadcrumb" className="mb-3">
            <ol className="flex items-center gap-1.5 font-body text-xs text-charcoal-faint">
              <li>
                <Link href="/marketplace" className="hover:text-charcoal">
                  Marketplace
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li className="text-charcoal truncate max-w-[200px]" aria-current="page">
                {listing.name}
              </li>
            </ol>
          </nav>

          <h1 className="font-headline text-3xl text-brand-black">{listing.name}</h1>

          <div className="flex flex-wrap items-center gap-3 mt-1.5">
            {category && (
              <span className="font-subhead text-xs text-charcoal-soft">{category.name}</span>
            )}
            {city && (
              <span className="flex items-center gap-1 font-body text-xs text-charcoal-soft">
                <MapPin className="size-3 shrink-0" aria-hidden="true" />
                {city.name}, {city.state_abbr}
              </span>
            )}
            {listing.trust_tier === 'verified' && (
              <span className="px-2 py-0.5 rounded-full bg-green-100 font-subhead text-xs font-semibold text-green-700">
                Verified
              </span>
            )}
          </div>

          {listing.tagline && (
            <p className="font-body text-sm text-charcoal-soft mt-2 max-w-2xl leading-relaxed">
              {listing.tagline}
            </p>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-10 space-y-14">
        {/* Products */}
        {hasProducts || hasServices ? (
          <>
            {hasProducts && (
              <section aria-labelledby="vendor-products-heading">
                <div className="flex items-center gap-2 mb-5">
                  <Package className="size-5 text-charcoal-faint" aria-hidden="true" />
                  <h2
                    id="vendor-products-heading"
                    className="font-headline text-xl text-brand-black"
                  >
                    Products
                  </h2>
                  <span className="ml-1 font-body text-xs text-charcoal-faint">
                    ({products.length})
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
                  {products.map((p) => (
                    <ProductCard key={p.id} product={p} showVendor={false} />
                  ))}
                </div>
              </section>
            )}

            {hasServices && (
              <section aria-labelledby="vendor-services-heading">
                <div className="flex items-center gap-2 mb-5">
                  <Briefcase className="size-5 text-charcoal-faint" aria-hidden="true" />
                  <h2
                    id="vendor-services-heading"
                    className="font-headline text-xl text-brand-black"
                  >
                    Services
                  </h2>
                  <span className="ml-1 font-body text-xs text-charcoal-faint">
                    ({services.length})
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
                  {services.map((s) => (
                    <ServiceCard key={s.id} service={s} showVendor={false} />
                  ))}
                </div>
              </section>
            )}
          </>
        ) : (
          <div className="rounded-xl border border-charcoal/10 bg-white py-20 text-center">
            <Package className="size-12 text-charcoal/20 mx-auto mb-4" aria-hidden="true" />
            <p className="font-headline text-lg text-brand-black">No marketplace listings yet</p>
            <p className="font-body text-sm text-charcoal-soft mt-2 max-w-xs mx-auto">
              {listing.name} hasn&apos;t added any products or services to the marketplace yet.
              Check back soon.
            </p>
          </div>
        )}

        <Link
          href="/marketplace"
          className="inline-flex items-center gap-1.5 font-subhead text-xs text-charcoal-faint hover:text-charcoal"
        >
          <ArrowLeft className="size-3" aria-hidden="true" />
          Back to marketplace
        </Link>
      </div>
    </div>
  )
}
