"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { getOwnerSession } from "@/lib/dashboard/guard"
import { buildEntityUrl } from "@/lib/listings/url"

export type DeleteServiceState =
  | { success: true }
  | { error: string }
  | null

export async function deleteServiceAction(
  _prev: DeleteServiceState,
  formData: FormData
): Promise<DeleteServiceState> {
  const owner = await getOwnerSession()
  if (!owner) return { error: "You must be signed in to delete a service." }

  const serviceId = formData.get("service_id")?.toString().trim() ?? ""
  if (!serviceId) return { error: "Missing service ID." }

  const supabase = await createClient()

  const { data: service } = await supabase
    .from("services")
    .select("id, listing_id, listings(id, slug, status, entity_type, city_id, cities(slug))")
    .eq("id", serviceId)
    .maybeSingle()

  if (!service) return { error: "Service not found." }

  const listing = service.listings as {
    id: string
    slug: string
    status: string
    entity_type: string
    city_id: string | null
    cities: { slug: string } | null
  } | null

  if (!listing) return { error: "Parent listing not found." }

  const { data: ownerCheck } = await supabase
    .from("listings")
    .select("id")
    .eq("id", listing.id)
    .eq("owner_user_id", owner.user.id)
    .maybeSingle()

  if (!ownerCheck) return { error: "You do not have permission to delete this service." }

  const { error } = await supabase
    .from("services")
    .delete()
    .eq("id", serviceId)

  if (error) return { error: "Failed to delete service. Please try again." }

  if (listing.status === "published") {
    const citySlug = listing.cities?.slug
    if (citySlug && listing.slug) {
      revalidatePath(buildEntityUrl(listing.entity_type, citySlug, listing.slug))
    }
  }

  return { success: true }
}
