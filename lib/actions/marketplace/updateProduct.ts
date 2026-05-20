"use server"

import { revalidatePath } from "next/cache"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import { VALID_SHIPPING_OPTIONS } from "./createProduct"

type FieldErrors = Partial<Record<string, string>>

export type UpdateProductState =
  | { success: true }
  | { error: string; fieldErrors?: FieldErrors }
  | null

function isValidUrl(url: string): boolean {
  return url.startsWith("https://") || url.startsWith("http://")
}

export async function updateProductAction(
  _prev: UpdateProductState,
  formData: FormData
): Promise<UpdateProductState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: "You must be signed in." }

  const productId    = formData.get("product_id")?.toString().trim() ?? ""
  const name         = formData.get("name")?.toString().trim() ?? ""
  const description  = formData.get("description")?.toString().trim() || null
  const priceRaw     = formData.get("price_cents")?.toString().trim() || null
  const compareRaw   = formData.get("compare_at_price_cents")?.toString().trim() || null
  const priceDisplay = formData.get("price_display_text")?.toString().trim() || null
  const coverUrl     = formData.get("cover_image_url")?.toString().trim() || null
  const categoryId   = formData.get("category_id")?.toString().trim() || null
  const tagsRaw      = formData.get("tags")?.toString().trim() || ""
  const shipping     = formData.get("shipping_options")?.toString().trim() || "shipping"
  const returnNote   = formData.get("return_policy_note")?.toString().trim() || null
  const purchaseUrl  = formData.get("external_purchase_url")?.toString().trim() || null
  const newStatus    = formData.get("status")?.toString().trim() || null

  if (!productId) return { error: "Product ID is required." }

  const fieldErrors: FieldErrors = {}

  if (name.length < 2)        fieldErrors.name = "Name must be at least 2 characters."
  else if (name.length > 200) fieldErrors.name = "Name must be 200 characters or fewer."

  const priceCents = priceRaw ? Math.round(parseFloat(priceRaw) * 100) : null
  if (priceRaw && (isNaN(priceCents!) || priceCents! <= 0)) {
    fieldErrors.price_cents = "Enter a valid price greater than $0."
  }

  const compareCents = compareRaw ? Math.round(parseFloat(compareRaw) * 100) : null
  if (compareRaw && (isNaN(compareCents!) || compareCents! <= 0)) {
    fieldErrors.compare_at_price_cents = "Enter a valid compare-at price."
  }
  if (priceCents && compareCents && compareCents <= priceCents) {
    fieldErrors.compare_at_price_cents = "Compare-at price must be higher than the sale price."
  }

  if (!VALID_SHIPPING_OPTIONS.includes(shipping as (typeof VALID_SHIPPING_OPTIONS)[number])) {
    fieldErrors.shipping_options = "Select a valid fulfillment option."
  }

  if (coverUrl && !isValidUrl(coverUrl)) {
    fieldErrors.cover_image_url = "Image URL must start with https://"
  }
  if (purchaseUrl && !isValidUrl(purchaseUrl)) {
    fieldErrors.external_purchase_url = "Purchase URL must start with https://"
  }

  if (newStatus && !["draft", "active", "archived"].includes(newStatus)) {
    fieldErrors.status = "Invalid status."
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { error: "Please fix the errors below.", fieldErrors }
  }

  // Verify ownership via join
  const { data: product } = await supabase
    .from("marketplace_products")
    .select("id, listing_id, global_slug, listings!inner(owner_user_id)")
    .eq("id", productId)
    .maybeSingle()

  if (!product) return { error: "Product not found." }

  const listingOwner = (product.listings as { owner_user_id: string | null } | null)?.owner_user_id
  if (listingOwner !== user.id) return { error: "You do not have permission to edit this product." }

  const tags = tagsRaw ? tagsRaw.split(",").map((t) => t.trim()).filter(Boolean) : []

  const serviceClient = createServiceClient()
  const { error: updateError } = await serviceClient
    .from("marketplace_products")
    .update({
      name,
      description,
      price_cents:            priceCents,
      compare_at_price_cents: compareCents,
      price_display_text:     priceDisplay,
      cover_image_url:        coverUrl,
      category_id:            categoryId || null,
      tags,
      shipping_options:       shipping,
      return_policy_note:     returnNote,
      external_purchase_url:  purchaseUrl,
      ...(newStatus ? { status: newStatus } : {}),
    })
    .eq("id", productId)

  if (updateError) return { error: "Failed to update product. Please try again." }

  revalidatePath("/dashboard/products")
  revalidatePath(`/dashboard/products/${productId}/edit`)
  revalidatePath(`/marketplace/products/${product.global_slug}`)
  revalidatePath("/marketplace/products")

  return { success: true }
}
