import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

import { requireOwner } from '@/lib/dashboard/guard'
import { createClient } from '@/lib/supabase/server'
import { ProductForm } from '@/components/marketplace/ProductForm'
import { NoListingsNotice } from '@/components/dashboard/NoListingsNotice'
import { AllowanceNotice } from '@/components/marketplace/AllowanceNotice'
import { createProductAction } from '@/lib/actions/marketplace/createProduct'
import { marketplaceAllowances } from '@/lib/marketplace/entitlements'

export const metadata: Metadata = { title: 'New Product | Dashboard' }

export default async function NewProductPage() {
  const owner = await requireOwner()
  const supabase = await createClient()

  // `tier` rides along because the marketplace allowance is per listing.
  const { data: listings } = await supabase
    .from('listings')
    .select('id, name, tier')
    .eq('owner_user_id', owner.user.id)
    .is('deleted_at', null)
    .order('name', { ascending: true })

  const owned = listings ?? []
  const allowances = await marketplaceAllowances(
    owned.map((l) => ({ id: l.id, tier: l.tier }))
  )
  const names = Object.fromEntries(owned.map((l) => [l.id, l.name]))

  // Only listings with room are offered in the selector — the same check the
  // server action runs, surfaced before the form instead of after it.
  const eligibleIds = new Set(allowances.filter((a) => a.canAddMore).map((a) => a.listingId))
  const eligible = owned
    .filter((l) => eligibleIds.has(l.id))
    .map((l) => ({ id: l.id, name: l.name }))

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link
          href="/dashboard/products"
          className="inline-flex items-center gap-1.5 font-subhead text-xs text-charcoal-faint hover:text-charcoal mb-3"
        >
          <ArrowLeft className="size-3" aria-hidden="true" />
          Back to products
        </Link>
        <h1 className="font-headline text-2xl text-brand-black">Add product</h1>
        <p className="font-body text-sm text-charcoal-soft mt-0.5">
          List a new product in the BLACQList Marketplace.
        </p>
      </div>

      {owned.length === 0 ? (
        <NoListingsNotice kind="product" />
      ) : (
        <>
          <AllowanceNotice allowances={allowances} names={names} kind="product" />
          {eligible.length > 0 && (
            <div className="rounded-xl border border-charcoal/10 bg-white p-6">
              <ProductForm
                action={createProductAction}
                listings={eligible}
                submitLabel="Create product"
              />
            </div>
          )}
        </>
      )}
    </div>
  )
}
