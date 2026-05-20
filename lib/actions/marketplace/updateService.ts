"use server"

import { revalidatePath } from "next/cache"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import { VALID_DELIVERY_MODES } from "./createService"

type FieldErrors = Partial<Record<string, string>>

export type UpdateServiceState =
  | { success: true }
  | { error: string; fieldErrors?: FieldErrors }
  | null

function isValidUrl(url: string): boolean {
  return url.startsWith("https://") || url.startsWith("http://")
}

export async function updateServiceAction(
  _prev: UpdateServiceState,
  formData: FormData
): Promise<UpdateServiceState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: "You must be signed in." }

  const serviceId    = formData.get("service_id")?.toString().trim() ?? ""
  const name         = formData.get("name")?.toString().trim() ?? ""
  const description  = formData.get("description")?.toString().trim() || null
  const priceRaw     = formData.get("starting_price_cents")?.toString().trim() || null
  const priceDisplay = formData.get("price_display_text")?.toString().trim() || null
  const duration     = formData.get("duration_text")?.toString().trim() || null
  const delivery     = formData.get("delivery_mode")?.toString().trim() || "in_person"
  const bookingUrl   = formData.get("booking_url")?.toString().trim() || null
  const coverUrl     = formData.get("cover_image_url")?.toString().trim() || null
  const newStatus    = formData.get("status")?.toString().trim() || null

  if (!serviceId) return { error: "Service ID is required." }

  const fieldErrors: FieldErrors = {}

  if (name.length < 2)        fieldErrors.name = "Name must be at least 2 characters."
  else if (name.length > 200) fieldErrors.name = "Name must be 200 characters or fewer."

  const priceCents = priceRaw ? Math.round(parseFloat(priceRaw) * 100) : null
  if (priceRaw && (isNaN(priceCents!) || priceCents! < 0)) {
    fieldErrors.starting_price_cents = "Enter a valid starting price."
  }

  if (!VALID_DELIVERY_MODES.includes(delivery as (typeof VALID_DELIVERY_MODES)[number])) {
    fieldErrors.delivery_mode = "Select a valid delivery option."
  }

  if (bookingUrl && !isValidUrl(bookingUrl)) {
    fieldErrors.booking_url = "Booking URL must start with https://"
  }
  if (coverUrl && !isValidUrl(coverUrl)) {
    fieldErrors.cover_image_url = "Image URL must start with https://"
  }
  if (newStatus && !["draft", "active", "archived"].includes(newStatus)) {
    fieldErrors.status = "Invalid status."
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { error: "Please fix the errors below.", fieldErrors }
  }

  // Verify ownership via join
  const { data: svc } = await supabase
    .from("marketplace_services")
    .select("id, listing_id, global_slug, listings!inner(owner_user_id)")
    .eq("id", serviceId)
    .maybeSingle()

  if (!svc) return { error: "Service not found." }

  const listingOwner = (svc.listings as { owner_user_id: string | null } | null)?.owner_user_id
  if (listingOwner !== user.id) return { error: "You do not have permission to edit this service." }

  const serviceClient = createServiceClient()
  const { error: updateError } = await serviceClient
    .from("marketplace_services")
    .update({
      name,
      description,
      starting_price_cents: priceCents,
      price_display_text:   priceDisplay,
      duration_text:        duration,
      delivery_mode:        delivery,
      booking_url:          bookingUrl,
      cover_image_url:      coverUrl,
      ...(newStatus ? { status: newStatus } : {}),
    })
    .eq("id", serviceId)

  if (updateError) return { error: "Failed to update service. Please try again." }

  revalidatePath("/dashboard/services")
  revalidatePath(`/dashboard/services/${serviceId}/edit`)
  revalidatePath(`/marketplace/services/${svc.global_slug}`)
  revalidatePath("/marketplace/services")

  return { success: true }
}
