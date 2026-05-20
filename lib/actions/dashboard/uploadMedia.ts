"use server"

import { revalidatePath } from "next/cache"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import { getOwnerSession } from "@/lib/dashboard/guard"
import { buildEntityUrl } from "@/lib/listings/url"

export type UploadMediaState =
  | { success: true; mediaId: string }
  | { error: string }
  | null

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"]
const MAX_BYTES = 5 * 1024 * 1024 // 5 MB

export async function uploadMediaAction(
  _prev: UploadMediaState,
  formData: FormData
): Promise<UploadMediaState> {
  const owner = await getOwnerSession()
  if (!owner) return { error: "You must be signed in to upload media." }

  const listingId = formData.get("listing_id")?.toString().trim() ?? ""
  const file = formData.get("file") as File | null

  if (!listingId) return { error: "Missing listing ID." }
  if (!file || file.size === 0) return { error: "No file selected." }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return { error: "Only JPEG, PNG, WebP, and GIF images are supported." }
  }
  if (file.size > MAX_BYTES) {
    return { error: "Image must be 5 MB or smaller." }
  }

  const supabase = await createClient()

  // Verify ownership
  const { data: listing } = await supabase
    .from("listings")
    .select("id, slug, status, entity_type, cities(slug)")
    .eq("id", listingId)
    .eq("owner_user_id", owner.user.id)
    .is("deleted_at", null)
    .maybeSingle()

  if (!listing) return { error: "Listing not found or you do not have permission to upload here." }

  // Build a unique storage path scoped to this listing
  const ext = file.type === "image/jpeg" ? "jpg" : file.type.split("/")[1]
  const fileName = `${crypto.randomUUID()}.${ext}`
  const filePath = `${listingId}/${fileName}`

  const serviceClient = createServiceClient()
  const fileBuffer = await file.arrayBuffer()

  const { error: uploadError } = await serviceClient.storage
    .from("listing-media")
    .upload(filePath, fileBuffer, { contentType: file.type, upsert: false })

  if (uploadError) return { error: "Upload failed. Please try again." }

  // Get the current highest display_order for this listing
  const { data: lastMedia } = await supabase
    .from("media_attachments")
    .select("display_order")
    .eq("entity_id", listingId)
    .eq("entity_type", "listing")
    .order("display_order", { ascending: false })
    .limit(1)
    .maybeSingle()

  const nextOrder = lastMedia?.display_order != null ? lastMedia.display_order + 1 : 0

  const { data: newMedia, error: dbError } = await serviceClient
    .from("media_attachments")
    .insert({
      entity_type: "listing",
      entity_id: listingId,
      file_path: filePath,
      file_type: file.type,
      file_size_bytes: file.size,
      display_order: nextOrder,
      uploaded_by: owner.user.id,
    })
    .select("id")
    .single()

  if (dbError || !newMedia) {
    // Best-effort storage cleanup
    await serviceClient.storage.from("listing-media").remove([filePath])
    return { error: "Failed to save media record. Please try again." }
  }

  if (listing.status === "published") {
    const citySlug = (listing.cities as { slug: string } | null)?.slug
    if (citySlug && listing.slug) {
      revalidatePath(buildEntityUrl(listing.entity_type, citySlug, listing.slug))
    }
  }

  return { success: true, mediaId: newMedia.id }
}
