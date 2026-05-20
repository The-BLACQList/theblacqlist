import { notFound } from "next/navigation"
import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { requireOwner } from "@/lib/dashboard/guard"
import { createClient } from "@/lib/supabase/server"
import { ProductForm } from "@/components/marketplace/ProductForm"
import { updateProductAction } from "@/lib/actions/marketplace/updateProduct"

interface Props {
  params: Promise<{ productId: string }>
}

export const metadata: Metadata = { title: "Edit Product | Dashboard" }

export default async function EditProductPage({ params }: Props) {
  const { productId } = await params
  const owner = await requireOwner()
  const supabase = await createClient()

  const [{ data: listings }, { data: product }] = await Promise.all([
    supabase
      .from("listings")
      .select("id, name")
      .eq("owner_user_id", owner.user.id)
      .is("deleted_at", null)
      .order("name", { ascending: true }),
    supabase
      .from("marketplace_products")
      .select("id, name, description, price_cents, compare_at_price_cents, price_display_text, cover_image_url, tags, shipping_options, return_policy_note, external_purchase_url, status, listing_id")
      .eq("id", productId)
      .maybeSingle(),
  ])

  if (!product) notFound()

  // Verify ownership
  const ownsListing = (listings ?? []).some((l) => l.id === product.listing_id)
  if (!ownsListing) notFound()

  const tagsValue = Array.isArray(product.tags)
    ? (product.tags as string[]).join(", ")
    : ""

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
        <h1 className="font-headline text-2xl text-brand-black">Edit product</h1>
        <p className="font-body text-sm text-charcoal/60 mt-0.5">{product.name}</p>
      </div>

      <div className="rounded-xl border border-charcoal/10 bg-white p-6">
        <ProductForm
          action={updateProductAction}
          listings={listings ?? []}
          defaultListingId={product.listing_id}
          defaultValues={{
            product_id:          product.id,
            name:                product.name,
            description:         product.description ?? "",
            price_dollars:       product.price_cents ? String(product.price_cents / 100) : "",
            compare_price_dollars: product.compare_at_price_cents ? String(product.compare_at_price_cents / 100) : "",
            price_display_text:  product.price_display_text ?? "",
            cover_image_url:     product.cover_image_url ?? "",
            tags:                tagsValue,
            shipping_options:    product.shipping_options ?? "shipping",
            return_policy_note:  product.return_policy_note ?? "",
            external_purchase_url: product.external_purchase_url ?? "",
            status:              product.status ?? "draft",
          }}
          submitLabel="Save changes"
        />
      </div>
    </div>
  )
}
