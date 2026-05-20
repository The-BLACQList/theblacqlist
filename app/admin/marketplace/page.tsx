import type { Metadata } from "next"
import Link from "next/link"

import { requireAdmin } from "@/lib/admin/guard"
import { createServiceClient } from "@/lib/supabase/server"
import { AdminStatusBadge } from "@/components/admin/AdminStatusBadge"

export const metadata: Metadata = { title: "Marketplace" }

export default async function AdminMarketplacePage() {
  await requireAdmin()
  const serviceClient = createServiceClient()

  const [
    { data: products },
    { data: services },
  ] = await Promise.all([
    serviceClient
      .from("marketplace_products")
      .select("id, name, status, global_slug, listing_id, created_at, listings(name, slug)")
      .order("created_at", { ascending: false })
      .limit(20),
    serviceClient
      .from("marketplace_services")
      .select("id, name, status, global_slug, listing_id, created_at, listings(name, slug)")
      .order("created_at", { ascending: false })
      .limit(20),
  ])

  type ListingRef = { name: string; slug: string } | null

  const productCounts = {
    active:   (products ?? []).filter((p) => p.status === "active").length,
    draft:    (products ?? []).filter((p) => p.status === "draft").length,
    archived: (products ?? []).filter((p) => p.status === "archived").length,
    total:    (products ?? []).length,
  }

  const serviceCounts = {
    active:   (services ?? []).filter((s) => s.status === "active").length,
    draft:    (services ?? []).filter((s) => s.status === "draft").length,
    archived: (services ?? []).filter((s) => s.status === "archived").length,
    total:    (services ?? []).length,
  }

  return (
    <div className="space-y-8 max-w-5xl">
      <div>
        <h1 className="font-headline text-2xl text-brand-black">Marketplace</h1>
        <p className="font-body text-sm text-charcoal/50 mt-0.5">
          Products and services listed in the BLACQList Marketplace.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Active products", count: productCounts.active },
          { label: "Draft products",  count: productCounts.draft  },
          { label: "Active services", count: serviceCounts.active },
          { label: "Draft services",  count: serviceCounts.draft  },
        ].map(({ label, count }) => (
          <div key={label} className="rounded-xl border border-charcoal/10 bg-white p-5">
            <p className="font-subhead text-xs text-charcoal/60 uppercase tracking-wide mb-1">{label}</p>
            <p className="font-headline text-4xl text-brand-black">{count.toLocaleString()}</p>
          </div>
        ))}
      </div>

      {/* Recent products */}
      <section aria-labelledby="products-heading">
        <div className="flex items-center justify-between mb-3">
          <h2 id="products-heading" className="font-subhead text-base font-semibold text-brand-black">
            Recent products
          </h2>
          <Link
            href="/marketplace/products"
            target="_blank"
            rel="noopener noreferrer"
            className="font-subhead text-xs text-amber-gold hover:text-light-gold"
          >
            View public marketplace →
          </Link>
        </div>
        <div className="rounded-xl border border-charcoal/10 bg-white overflow-hidden">
          {(products ?? []).length === 0 ? (
            <p className="px-5 py-8 font-body text-sm text-charcoal/50 text-center">No products yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-charcoal/10 bg-[#f5f5f7]">
                  <th className="px-5 py-3 text-left font-subhead text-xs font-semibold text-charcoal/50 uppercase tracking-wide">Product</th>
                  <th className="px-5 py-3 text-left font-subhead text-xs font-semibold text-charcoal/50 uppercase tracking-wide hidden md:table-cell">Vendor</th>
                  <th className="px-5 py-3 text-left font-subhead text-xs font-semibold text-charcoal/50 uppercase tracking-wide">Status</th>
                  <th className="px-5 py-3 text-right font-subhead text-xs font-semibold text-charcoal/50 uppercase tracking-wide">View</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-charcoal/5">
                {(products ?? []).map((p) => {
                  const listing = p.listings as ListingRef
                  return (
                    <tr key={p.id} className="hover:bg-[#f5f5f7]/60 transition-colors">
                      <td className="px-5 py-3">
                        <p className="font-subhead text-sm font-semibold text-brand-black">{p.name}</p>
                      </td>
                      <td className="px-5 py-3 hidden md:table-cell">
                        {listing && (
                          <Link href={`/vendors/${listing.slug}`} className="font-body text-xs text-charcoal/60 hover:text-charcoal" target="_blank">
                            {listing.name}
                          </Link>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <AdminStatusBadge status={p.status} />
                      </td>
                      <td className="px-5 py-3 text-right">
                        {p.status === "active" && p.global_slug && (
                          <Link
                            href={`/marketplace/products/${p.global_slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-subhead text-xs text-amber-gold hover:text-light-gold"
                          >
                            View →
                          </Link>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* Recent services */}
      <section aria-labelledby="services-heading">
        <div className="flex items-center justify-between mb-3">
          <h2 id="services-heading" className="font-subhead text-base font-semibold text-brand-black">
            Recent services
          </h2>
          <Link
            href="/marketplace/services"
            target="_blank"
            rel="noopener noreferrer"
            className="font-subhead text-xs text-amber-gold hover:text-light-gold"
          >
            View public marketplace →
          </Link>
        </div>
        <div className="rounded-xl border border-charcoal/10 bg-white overflow-hidden">
          {(services ?? []).length === 0 ? (
            <p className="px-5 py-8 font-body text-sm text-charcoal/50 text-center">No services yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-charcoal/10 bg-[#f5f5f7]">
                  <th className="px-5 py-3 text-left font-subhead text-xs font-semibold text-charcoal/50 uppercase tracking-wide">Service</th>
                  <th className="px-5 py-3 text-left font-subhead text-xs font-semibold text-charcoal/50 uppercase tracking-wide hidden md:table-cell">Provider</th>
                  <th className="px-5 py-3 text-left font-subhead text-xs font-semibold text-charcoal/50 uppercase tracking-wide">Status</th>
                  <th className="px-5 py-3 text-right font-subhead text-xs font-semibold text-charcoal/50 uppercase tracking-wide">View</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-charcoal/5">
                {(services ?? []).map((s) => {
                  const listing = s.listings as ListingRef
                  return (
                    <tr key={s.id} className="hover:bg-[#f5f5f7]/60 transition-colors">
                      <td className="px-5 py-3">
                        <p className="font-subhead text-sm font-semibold text-brand-black">{s.name}</p>
                      </td>
                      <td className="px-5 py-3 hidden md:table-cell">
                        {listing && (
                          <Link href={`/vendors/${listing.slug}`} className="font-body text-xs text-charcoal/60 hover:text-charcoal" target="_blank">
                            {listing.name}
                          </Link>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <AdminStatusBadge status={s.status} />
                      </td>
                      <td className="px-5 py-3 text-right">
                        {s.status === "active" && s.global_slug && (
                          <Link
                            href={`/marketplace/services/${s.global_slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-subhead text-xs text-amber-gold hover:text-light-gold"
                          >
                            View →
                          </Link>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  )
}
