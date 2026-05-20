import type { Metadata } from 'next'
import Link from 'next/link'
import { Plus, Package, ExternalLink } from 'lucide-react'

import { requireOwner } from '@/lib/dashboard/guard'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Products | Dashboard' }

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  draft: 'bg-charcoal/10 text-charcoal/60',
  archived: 'bg-amber-100 text-amber-700',
}

export default async function DashboardProductsPage() {
  const owner = await requireOwner()
  const supabase = await createClient()

  // Fetch owner's listing IDs
  const { data: listings } = await supabase
    .from('listings')
    .select('id, name')
    .eq('owner_user_id', owner.user.id)
    .is('deleted_at', null)

  const listingIds = (listings ?? []).map((l) => l.id)
  const listingNameById: Record<string, string> = {}
  for (const l of listings ?? []) listingNameById[l.id] = l.name

  const { data: rows } =
    listingIds.length > 0
      ? await supabase
          .from('marketplace_products')
          .select('id, name, global_slug, status, price_cents, price_display_text, listing_id')
          .in('listing_id', listingIds)
          .order('created_at', { ascending: false })
      : { data: [] }

  const products = (rows ?? []).map((p) => ({
    ...p,
    listing_name: listingNameById[p.listing_id] ?? '—',
  }))

  function formatPrice(cents: number): string {
    return (cents / 100).toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    })
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-headline text-2xl text-brand-black">Products</h1>
          <p className="font-body text-sm text-charcoal/60 mt-0.5">
            Manage your marketplace products.
          </p>
        </div>
        <Link
          href="/dashboard/products/new"
          className="inline-flex items-center gap-2 h-10 px-5 rounded-full bg-amber-gold text-brand-black font-subhead font-bold text-sm hover:bg-light-gold transition-colors min-h-[44px]"
        >
          <Plus className="size-4 shrink-0" aria-hidden="true" />
          Add product
        </Link>
      </div>

      {products.length === 0 ? (
        <div className="rounded-xl border border-charcoal/10 bg-white py-16 text-center">
          <Package className="size-12 text-charcoal/20 mx-auto mb-4" aria-hidden="true" />
          <p className="font-headline text-lg text-brand-black">No products yet</p>
          <p className="font-body text-sm text-charcoal/50 mt-2 max-w-xs mx-auto">
            Add your first product to start selling in the marketplace.
          </p>
          <Link
            href="/dashboard/products/new"
            className="inline-flex items-center gap-2 h-10 px-5 mt-5 rounded-full bg-amber-gold text-brand-black font-subhead font-bold text-sm hover:bg-light-gold transition-colors min-h-[44px]"
          >
            <Plus className="size-4 shrink-0" aria-hidden="true" />
            Add your first product
          </Link>
        </div>
      ) : (
        <div className="rounded-xl border border-charcoal/10 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-charcoal/10 bg-pale-lavender/40">
                <th className="px-5 py-3 text-left font-subhead text-xs font-semibold text-charcoal/50 uppercase tracking-wide">
                  Product
                </th>
                <th className="px-5 py-3 text-left font-subhead text-xs font-semibold text-charcoal/50 uppercase tracking-wide hidden sm:table-cell">
                  Listing
                </th>
                <th className="px-5 py-3 text-left font-subhead text-xs font-semibold text-charcoal/50 uppercase tracking-wide hidden md:table-cell">
                  Price
                </th>
                <th className="px-5 py-3 text-left font-subhead text-xs font-semibold text-charcoal/50 uppercase tracking-wide">
                  Status
                </th>
                <th className="px-5 py-3 text-right font-subhead text-xs font-semibold text-charcoal/50 uppercase tracking-wide">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-charcoal/5">
              {products.map((p) => (
                <tr key={p.id} className="hover:bg-pale-lavender/20 transition-colors">
                  <td className="px-5 py-4">
                    <p className="font-subhead text-sm font-semibold text-brand-black">{p.name}</p>
                  </td>
                  <td className="px-5 py-4 hidden sm:table-cell">
                    <p className="font-body text-xs text-charcoal/60">{p.listing_name}</p>
                  </td>
                  <td className="px-5 py-4 hidden md:table-cell">
                    <p className="font-body text-xs text-charcoal/60">
                      {p.price_display_text ?? (p.price_cents ? formatPrice(p.price_cents) : '—')}
                    </p>
                  </td>
                  <td className="px-5 py-4">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full font-subhead text-xs font-semibold ${STATUS_STYLES[p.status] ?? 'bg-charcoal/10 text-charcoal/60'}`}
                    >
                      {p.status}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center justify-end gap-2">
                      {p.status === 'active' && p.global_slug && (
                        <Link
                          href={`/marketplace/products/${p.global_slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label="View public product page"
                          className="inline-flex items-center justify-center size-8 rounded-lg text-charcoal/40 hover:text-charcoal hover:bg-charcoal/5 transition-colors"
                        >
                          <ExternalLink className="size-4" aria-hidden="true" />
                        </Link>
                      )}
                      <Link
                        href={`/dashboard/products/${p.id}/edit`}
                        className="inline-flex items-center h-8 px-3 rounded-lg bg-charcoal/10 text-brand-black font-subhead font-semibold text-xs hover:bg-charcoal/20 transition-colors"
                      >
                        Edit
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
