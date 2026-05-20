import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { requireOwner } from "@/lib/dashboard/guard"
import { createClient } from "@/lib/supabase/server"
import { ProductForm } from "@/components/marketplace/ProductForm"
import { createProductAction } from "@/lib/actions/marketplace/createProduct"

export const metadata: Metadata = { title: "New Product | Dashboard" }

export default async function NewProductPage() {
  const owner = await requireOwner()
  const supabase = await createClient()

  const { data: listings } = await supabase
    .from("listings")
    .select("id, name")
    .eq("owner_user_id", owner.user.id)
    .is("deleted_at", null)
    .order("name", { ascending: true })

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link
          href="/dashboard/products"
          className="inline-flex items-center gap-1.5 font-subhead text-xs text-charcoal/40 hover:text-charcoal mb-3"
        >
          <ArrowLeft className="size-3" aria-hidden="true" />
          Back to products
        </Link>
        <h1 className="font-headline text-2xl text-brand-black">Add product</h1>
        <p className="font-body text-sm text-charcoal/60 mt-0.5">
          List a new product in the BLACQList Marketplace.
        </p>
      </div>

      <div className="rounded-xl border border-charcoal/10 bg-white p-6">
        <ProductForm
          action={createProductAction}
          listings={listings ?? []}
          submitLabel="Create product"
        />
      </div>
    </div>
  )
}
