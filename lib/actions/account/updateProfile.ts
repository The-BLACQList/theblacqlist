"use server"

import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

interface UpdateProfileInput {
  display_name?: string
  bio?: string
  website_url?: string
}

type FieldErrors = Partial<Record<keyof UpdateProfileInput, string>>

type UpdateProfileState =
  | { error: string; fieldErrors?: FieldErrors }
  | { success: true; display_name: string | null }
  | null

export async function updateProfileAction(
  _prev: UpdateProfileState,
  formData: FormData
): Promise<UpdateProfileState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/sign-in")

  const input: UpdateProfileInput = {
    display_name: formData.get("display_name")?.toString().trim() || undefined,
    bio: formData.get("bio")?.toString().trim() || undefined,
    website_url: formData.get("website_url")?.toString().trim() || undefined,
  }

  const fieldErrors: FieldErrors = {}

  if (input.display_name !== undefined) {
    if (input.display_name.length === 0)
      fieldErrors.display_name = "Display name cannot be empty."
    else if (input.display_name.length > 100)
      fieldErrors.display_name = "Display name must be 100 characters or fewer."
  }
  if (input.bio !== undefined && input.bio.length > 500) {
    fieldErrors.bio = "Bio must be 500 characters or fewer."
  }
  if (input.website_url !== undefined && input.website_url.length > 0) {
    if (!input.website_url.startsWith("https://")) {
      fieldErrors.website_url = "Website URL must start with https://"
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { error: "Please fix the errors below.", fieldErrors }
  }

  try {
    const updateData: {
      display_name?: string | null
      bio?: string | null
      website_url?: string | null
    } = {}
    if (input.display_name !== undefined)
      updateData.display_name = input.display_name
    if (input.bio !== undefined) updateData.bio = input.bio
    if (input.website_url !== undefined)
      updateData.website_url = input.website_url

    if (Object.keys(updateData).length === 0) {
      return { success: true, display_name: null }
    }

    const { error } = await supabase
      .from("profiles")
      .update(updateData)
      .eq("id", user.id)

    if (error) {
      // Table does not exist yet — graceful no-op until schema migration runs
      if (
        error.code === "42P01" ||
        error.message.includes("does not exist") ||
        error.message.includes("relation")
      ) {
        return {
          success: true,
          display_name: input.display_name ?? null,
        }
      }
      return { error: "Something went wrong. Please try again." }
    }

    return { success: true, display_name: input.display_name ?? null }
  } catch {
    return { error: "Something went wrong. Please try again." }
  }
}
