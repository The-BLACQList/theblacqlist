"use server"

import { createClient, createServiceClient } from "@/lib/supabase/server"

type FieldErrors = Partial<Record<string, string>>

export type CreateProductState =
  | { success: true; productId: string; globalSlug: string }
  | { error: string; fieldErrors?: FieldErrors }
  | null

export const VALID_SHIPPING_OPTIONS = [
  "shipping",
  "pickup",
  "both",
  "digital",
  "none",
] as const

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80)
}

function isValidUrl(url: string): boolean {
  return url.startsWith("https://") || url.startsWith("http://")
}

export async function createProductAction(
  _prev: unknown,
  formData: FormData
): Promise<CreateProductState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: "You must be signed in to create a product." }

  const listingId     = formData.get("listing_id")?.toString().trim() ?? ""
  const name          = formData.get("name")?.toString().trim() ?? ""
  const description   = formData.get("description")?.toString().trim() || null
  const priceRaw      = formData.get("price_cents")?.toString().trim() || null
  const compareRaw    = formData.get("compare_at_price_cents")?.toString().trim() || null
  const priceDisplay  = formData.get("price_display_text")?.toString().trim() || null
  const coverUrl      = formData.get("cover_image_url")?.toString().trim() || null
  const categoryId    = formData.get("category_id")?.toString().trim() || null
  const tagsRaw       = formData.get("tags")?.toString().trim() || ""
  const shipping      = formData.get("shipping_options")?.toString().trim() || "shipping"
  const returnNote    = formData.get("return_policy_note")?.toString().trim() || null
  const purchaseUrl   = formData.get("external_purchase_url")?.toString().trim() || null

  const fieldErrors: FieldErrors = {}

  if (!listingId) fieldErrors.listing_id = "Select a listing."

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

  if (Object.keys(fieldErrors).length > 0) {
    return { error: "Please fix the errors below.", fieldErrors }
  }

  // Verify user owns the listing
  const { data: listing } = await supabase
    .from("listings")
    .select("id, slug")
    .eq("id", listingId)
    .eq("owner_user_id", user.id)
    .is("deleted_at", null)
    .maybeSingle()

  if (!listing) {
    return { error: "Listing not found or you do not have permission.", fieldErrors: { listing_id: "Invalid listing." } }
  }

  const tags = tagsRaw ? tagsRaw.split(",").map((t) => t.trim()).filter(Boolean) : []

  // Generate scoped slug
  let slug = generateSlug(name)
  if (!slug) slug = `product-${Date.now().toString(36)}`

  const { data: existingScoped } = await supabase
    .from("marketplace_products")
    .select("id")
    .eq("listing_id", listingId)
    .eq("slug", slug)
    .maybeSingle()

  if (existingScoped) slug = `${slug}-${Date.now().toString(36)}`

  // Generate globally unique slug
  let globalSlug = `${listing.slug}-${slug}`

  const serviceClient = createServiceClient()
  const { data: existingGlobal } = await serviceClient
    .from("marketplace_products")
    .select("id")
    .eq("global_slug", globalSlug)
    .maybeSingle()

  if (existingGlobal) globalSlug = `${globalSlug}-${Date.now().toString(36)}`

  const { data: product, error: insertError } = await serviceClient
    .from("marketplace_products")
    .insert({
      listing_id:             listingId,
      name,
      slug,
      global_slug:            globalSlug,
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
      status:                 "draft",
      created_by:             user.id,
    })
    .select("id, global_slug")
    .single()

  if (insertError || !product) {
    return { error: "Failed to create product. Please try again." }
  }

  void serviceClient.from("analytics_events").insert({
    event_name:  "product_created",
    entity_id:   product.id,
    entity_type: "marketplace_product",
    user_id:     user.id,
    properties:  { listing_id: listingId },
  })

  return { success: true, productId: product.id, globalSlug: product.global_slug }
}
