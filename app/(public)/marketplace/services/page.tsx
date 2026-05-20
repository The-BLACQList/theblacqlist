import type { Metadata } from "next"
import { Briefcase } from "lucide-react"
import Link from "next/link"

import { createServiceClient } from "@/lib/supabase/server"
import { ServiceCard } from "@/components/marketplace/ServiceCard"

export const metadata: Metadata = {
  title: "Services | BLACQList Marketplace",
  description: "Book and hire services from Black-owned businesses. Virtual, in-person, and more.",
}

export const revalidate = 3600

export default async function MarketplaceServicesPage() {
  const serviceClient = createServiceClient()

  const { data: rows } = await serviceClient
    .from("marketplace_services")
    .select("id, name, global_slug, description, starting_price_cents, price_display_text, duration_text, delivery_mode, booking_url, cover_image_url, listing_id, listings(name, slug)")
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(48)

  type ListingRef = { name: string; slug: string } | null

  const services = (rows ?? []).map((s) => {
    const listing = s.listings as ListingRef
    return {
      ...s,
      vendor_name: listing?.name ?? undefined,
      vendor_slug: listing?.slug ?? undefined,
    }
  })

  return (
    <div className="min-h-screen bg-cream">
      <div className="bg-white border-b border-charcoal/10 py-8">
        <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8">
          <nav aria-label="Breadcrumb" className="mb-3">
            <ol className="flex items-center gap-1.5 font-body text-xs text-charcoal/40">
              <li><Link href="/marketplace" className="hover:text-charcoal">Marketplace</Link></li>
              <li aria-hidden="true">/</li>
              <li className="text-charcoal" aria-current="page">Services</li>
            </ol>
          </nav>
          <h1 className="font-headline text-3xl text-brand-black">Services</h1>
          <p className="font-body text-sm text-charcoal/50 mt-1">
            {services.length > 0
              ? `${services.length} service${services.length === 1 ? "" : "s"} from Black-owned businesses`
              : "Services from Black-owned businesses"}
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-8">
        {services.length === 0 ? (
          <div className="rounded-xl border border-charcoal/10 bg-white py-20 text-center">
            <Briefcase className="size-12 text-charcoal/20 mx-auto mb-4" aria-hidden="true" />
            <p className="font-headline text-lg text-brand-black">No services yet</p>
            <p className="font-body text-sm text-charcoal/50 mt-2 max-w-xs mx-auto">
              Service providers are building their listings. Check back soon.
            </p>
            <Link
              href="/add-business"
              className="inline-flex items-center h-10 px-5 mt-5 rounded-full bg-amber-gold text-brand-black font-subhead font-bold text-sm hover:bg-light-gold transition-colors"
            >
              List your business
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {services.map((s) => (
              <ServiceCard key={s.id} service={s} showVendor />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
