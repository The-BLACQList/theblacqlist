import Link from "next/link"
import type { Metadata } from "next"
import { Package, Briefcase, ArrowRight } from "lucide-react"

import { createServiceClient } from "@/lib/supabase/server"
import { ProductCard } from "@/components/marketplace/ProductCard"
import { ServiceCard } from "@/components/marketplace/ServiceCard"

export const metadata: Metadata = {
  title: "Marketplace | The BLACQList",
  description:
    "Shop products and book services from Black-owned businesses. Visit their storefronts and keep the dollar circulating.",
}

export const revalidate = 3600

export default async function MarketplacePage() {
  const serviceClient = createServiceClient()

  // Latest active products
  const { data: productRows } = await serviceClient
    .from("marketplace_products")
    .select("id, name, global_slug, description, price_cents, compare_at_price_cents, price_display_text, cover_image_url, shipping_options, external_purchase_url, listing_id, listings(name, slug)")
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(8)

  // Latest active services
  const { data: serviceRows } = await serviceClient
    .from("marketplace_services")
    .select("id, name, global_slug, description, starting_price_cents, price_display_text, duration_text, delivery_mode, booking_url, cover_image_url, listing_id, listings(name, slug)")
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(8)

  type ListingRef = { name: string; slug: string } | null

  const products = (productRows ?? []).map((p) => {
    const listing = p.listings as ListingRef
    return {
      ...p,
      vendor_name: listing?.name ?? undefined,
      vendor_slug: listing?.slug ?? undefined,
    }
  })

  const services = (serviceRows ?? []).map((s) => {
    const listing = s.listings as ListingRef
    return {
      ...s,
      vendor_name: listing?.name ?? undefined,
      vendor_slug: listing?.slug ?? undefined,
    }
  })

  const hasProducts = products.length > 0
  const hasServices = services.length > 0

  return (
    <div className="min-h-screen bg-cream">
      {/* Hero */}
      <section className="bg-brand-black py-16 md:py-20">
        <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8">
          <p className="font-subhead text-xs font-semibold text-amber-gold uppercase tracking-widest mb-3">
            BLACQList Marketplace
          </p>
          <h1 className="font-headline text-4xl md:text-5xl text-white leading-tight max-w-2xl">
            Shop Black. Book Black.{" "}
            <span className="text-amber-gold">Keep the dollar moving.</span>
          </h1>
          <p className="font-body text-base text-white/60 mt-4 max-w-xl">
            Products and services from verified Black-owned businesses. Every purchase is a vote for the community.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 mt-8">
            <Link
              href="/marketplace/products"
              className="inline-flex items-center gap-2 h-11 px-6 rounded-full bg-amber-gold text-brand-black font-subhead font-bold text-sm hover:bg-light-gold transition-colors min-h-[44px]"
            >
              <Package className="size-4 shrink-0" aria-hidden="true" />
              Browse Products
            </Link>
            <Link
              href="/marketplace/services"
              className="inline-flex items-center gap-2 h-11 px-6 rounded-full border border-white/30 text-white font-subhead font-bold text-sm hover:bg-white/10 transition-colors min-h-[44px]"
            >
              <Briefcase className="size-4 shrink-0" aria-hidden="true" />
              Browse Services
            </Link>
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-12 space-y-16">

        {/* Products section */}
        <section aria-labelledby="products-heading">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 id="products-heading" className="font-headline text-2xl text-brand-black">
                Featured Products
              </h2>
              <p className="font-body text-sm text-charcoal/50 mt-0.5">
                Shipped nationwide or available for pickup
              </p>
            </div>
            <Link
              href="/marketplace/products"
              className="inline-flex items-center gap-1 font-subhead text-sm font-semibold text-amber-gold hover:text-light-gold transition-colors"
              aria-label="View all products"
            >
              View all <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </div>

          {hasProducts ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
              {products.map((p) => (
                <ProductCard key={p.id} product={p} showVendor />
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-charcoal/10 bg-white py-16 text-center">
              <Package className="size-10 text-charcoal/20 mx-auto mb-3" aria-hidden="true" />
              <p className="font-subhead text-sm font-semibold text-brand-black">No products yet</p>
              <p className="font-body text-xs text-charcoal/50 mt-1 max-w-xs mx-auto">
                Vendors are setting up their storefronts. Check back soon.
              </p>
              <Link
                href="/add-business"
                className="inline-flex items-center gap-1.5 mt-4 font-subhead text-sm font-semibold text-amber-gold hover:text-light-gold"
              >
                List your business <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </div>
          )}
        </section>

        {/* Services section */}
        <section aria-labelledby="services-heading">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 id="services-heading" className="font-headline text-2xl text-brand-black">
                Featured Services
              </h2>
              <p className="font-body text-sm text-charcoal/50 mt-0.5">
                Book sessions, request quotes, or hire a professional
              </p>
            </div>
            <Link
              href="/marketplace/services"
              className="inline-flex items-center gap-1 font-subhead text-sm font-semibold text-amber-gold hover:text-light-gold transition-colors"
              aria-label="View all services"
            >
              View all <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </div>

          {hasServices ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
              {services.map((s) => (
                <ServiceCard key={s.id} service={s} showVendor />
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-charcoal/10 bg-white py-16 text-center">
              <Briefcase className="size-10 text-charcoal/20 mx-auto mb-3" aria-hidden="true" />
              <p className="font-subhead text-sm font-semibold text-brand-black">No services yet</p>
              <p className="font-body text-xs text-charcoal/50 mt-1 max-w-xs mx-auto">
                Service providers are joining the marketplace. Check back soon.
              </p>
            </div>
          )}
        </section>

        {/* Vendor CTA */}
        <section className="rounded-xl bg-pale-lavender px-6 py-10 text-center">
          <h2 className="font-headline text-2xl text-brand-black">Sell on BLACQList</h2>
          <p className="font-body text-sm text-charcoal/60 mt-2 max-w-md mx-auto">
            Have products or services to offer? List your business and start reaching the community.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 mt-6 justify-center">
            <Link
              href="/add-business"
              className="inline-flex items-center gap-2 h-11 px-6 rounded-full bg-brand-black text-white font-subhead font-bold text-sm hover:bg-charcoal transition-colors min-h-[44px]"
            >
              List your business
            </Link>
            <Link
              href="/for-vendors"
              className="inline-flex items-center gap-2 h-11 px-6 rounded-full border border-brand-black text-brand-black font-subhead font-bold text-sm hover:bg-brand-black hover:text-white transition-colors min-h-[44px]"
            >
              Learn more
            </Link>
          </div>
        </section>

      </div>
    </div>
  )
}
